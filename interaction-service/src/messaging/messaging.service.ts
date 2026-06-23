import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { Message } from './entities/message.entity.js';
import { MessagingEventsPublisher } from './messaging-events.publisher.js';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly userServiceUrl: string;
  private readonly internalToken: string;
  private readonly appUrl: string;

  constructor(
    @InjectRepository(Conversation)
    private conversationsRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private messagesRepo: Repository<Message>,
    @InjectDataSource()
    private dataSource: DataSource,
    private configService: ConfigService,
    private eventsPublisher: MessagingEventsPublisher,
  ) {
    this.userServiceUrl = this.configService.get<string>(
      'USER_SERVICE_URL',
      'http://user-service:3010',
    );
    this.internalToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN', '');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getUserNames(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();

    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`${this.userServiceUrl}/api/users/public/${id}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    );

    const nameMap = new Map<number, string>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const u = result.value as { id: number; firstname?: string; lastname?: string };
        const initial = u.lastname ? `${u.lastname.charAt(0).toUpperCase()}.` : '';
        const name = [u.firstname, initial].filter(Boolean).join(' ') || `User ${u.id}`;
        nameMap.set(ids[index], name);
      }
    });

    return nameMap;
  }

  private assertParticipant(conv: Conversation, userId: number) {
    if (conv.buyer_id !== userId && conv.artist_id !== userId) {
      throw new ForbiddenException('Accès interdit');
    }
  }

  /** Récupère les infos complètes d'un user (email inclus) via l'endpoint interne. */
  private async getUserInternal(
    id: number,
  ): Promise<{ id: number; email: string; firstname: string; lastname: string } | null> {
    try {
      const res = await fetch(`${this.userServiceUrl}/api/users/internal/${id}`, {
        headers: { 'x-service-token': this.internalToken },
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Crée ou retourne la conversation entre cet acheteur et cet artisan. */
  async getOrCreate(userId: number, artistUserId: number): Promise<{ id: number }> {
    if (userId === artistUserId) {
      throw new BadRequestException('Vous ne pouvez pas vous envoyer un message à vous-même');
    }

    const existing = await this.conversationsRepo.findOne({
      where: { buyer_id: userId, artist_id: artistUserId },
    });
    if (existing) return { id: existing.id };

    const conv = this.conversationsRepo.create({
      buyer_id: userId,
      artist_id: artistUserId,
    });
    await this.conversationsRepo.save(conv);
    return { id: conv.id };
  }

  /** Liste toutes les conversations de l'utilisateur avec résumé. */
  async listConversations(userId: number) {
    const conversations = await this.conversationsRepo.find({
      where: [{ buyer_id: userId }, { artist_id: userId }],
      order: { updated_at: 'DESC' },
    });

    if (!conversations.length) return [];

    const convIds = conversations.map((c) => c.id);

    // Last message per conversation
    const lastMessages: { conversation_id: number; content: string; created_at: Date; sender_id: number }[] =
      await this.dataSource.query(
        `SELECT DISTINCT ON (conversation_id) conversation_id, content, created_at, sender_id
         FROM messages
         WHERE conversation_id = ANY($1)
         ORDER BY conversation_id, created_at DESC`,
        [convIds],
      );

    const lastMsgMap = new Map(lastMessages.map((m) => [m.conversation_id, m]));

    // Unread count per conversation (messages sent by the OTHER party, not yet read)
    const unreadRows: { conversation_id: number; count: string }[] =
      await this.dataSource.query(
        `SELECT conversation_id, COUNT(*) as count
         FROM messages
         WHERE conversation_id = ANY($1)
           AND sender_id != $2
           AND read_at IS NULL
         GROUP BY conversation_id`,
        [convIds, userId],
      );
    const unreadMap = new Map(unreadRows.map((r) => [r.conversation_id, parseInt(r.count)]));

    // Collect all user IDs to fetch names
    const userIds = [...new Set(conversations.flatMap((c) => [c.buyer_id, c.artist_id]))];
    const nameMap = await this.getUserNames(userIds);

    return conversations.map((conv) => {
      const otherId = conv.buyer_id === userId ? conv.artist_id : conv.buyer_id;
      const last = lastMsgMap.get(conv.id);
      return {
        id: conv.id,
        buyer_id: conv.buyer_id,
        artist_id: conv.artist_id,
        other_user_id: otherId,
        other_user_name: nameMap.get(otherId) || null,
        last_message: last?.content ?? null,
        last_message_at: last?.created_at ?? null,
        last_message_mine: last ? last.sender_id === userId : null,
        unread_count: unreadMap.get(conv.id) ?? 0,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
      };
    });
  }

  /** Retourne une conversation et ses messages paginés. */
  async getMessages(userId: number, conversationId: number, page = 1, limit = 50) {
    const conv = await this.conversationsRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');
    this.assertParticipant(conv, userId);

    const offset = (page - 1) * limit;
    const [msgs, total] = await this.messagesRepo.findAndCount({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      skip: offset,
      take: limit,
    });

    const otherId = conv.buyer_id === userId ? conv.artist_id : conv.buyer_id;
    const nameMap = await this.getUserNames([userId, otherId]);

    return {
      conversation: {
        id: conv.id,
        buyer_id: conv.buyer_id,
        artist_id: conv.artist_id,
        other_user_id: otherId,
        other_user_name: nameMap.get(otherId) || null,
      },
      total,
      page,
      limit,
      data: msgs,
    };
  }

  /** Envoie un message dans une conversation. */
  async sendMessage(userId: number, conversationId: number, content: string) {
    const conv = await this.conversationsRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');
    this.assertParticipant(conv, userId);

    const trimmed = content.trim();
    if (!trimmed) throw new BadRequestException('Le message ne peut pas être vide');

    const msg = this.messagesRepo.create({
      conversation_id: conversationId,
      sender_id: userId,
      content: trimmed,
      read_at: null,
    });
    await this.messagesRepo.save(msg);

    // Update conversation updated_at for ordering
    await this.conversationsRepo.update(conversationId, { updated_at: new Date() });

    // Notify recipient by email — fire and forget, never block the response
    const recipientId = conv.buyer_id === userId ? conv.artist_id : conv.buyer_id;
    this.notifyRecipient(userId, recipientId, conversationId, trimmed).catch((err) =>
      this.logger.error(`notifyRecipient failed: ${(err as Error).message}`),
    );

    return msg;
  }

  private async notifyRecipient(
    senderId: number,
    recipientId: number,
    conversationId: number,
    content: string,
  ): Promise<void> {
    const [sender, recipient] = await Promise.all([
      this.getUserInternal(senderId),
      this.getUserInternal(recipientId),
    ]);

    if (!recipient?.email) {
      this.logger.warn(`[message.received] recipient ${recipientId} not found, skipping email`);
      return;
    }

    const senderName = sender
      ? [sender.firstname, sender.lastname].filter(Boolean).join(' ')
      : 'Quelqu\'un';

    const preview = content.length > 120 ? `${content.substring(0, 120)}…` : content;

    await this.eventsPublisher.publish('message.received', {
      recipientEmail: recipient.email,
      recipientName: [recipient.firstname, recipient.lastname].filter(Boolean).join(' '),
      senderName,
      messagePreview: preview,
      conversationUrl: `${this.appUrl}/account/messages?c=${conversationId}`,
    });
  }

  /** Marque comme lus tous les messages reçus dans cette conversation. */
  async markRead(userId: number, conversationId: number) {
    const conv = await this.conversationsRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation introuvable');
    this.assertParticipant(conv, userId);

    await this.dataSource.query(
      `UPDATE messages SET read_at = NOW()
       WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [conversationId, userId],
    );

    return { ok: true };
  }

  /** Nombre total de messages non lus pour l'utilisateur. */
  async getUnreadCount(userId: number): Promise<{ count: number }> {
    const rows: { conversation_id: number }[] = await this.dataSource.query(
      `SELECT DISTINCT conversation_id FROM conversations WHERE buyer_id = $1 OR artist_id = $1`,
      [userId],
    );
    if (!rows.length) return { count: 0 };

    const convIds = rows.map((r) => r.conversation_id);
    const result: { count: string }[] = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM messages
       WHERE conversation_id = ANY($1) AND sender_id != $2 AND read_at IS NULL`,
      [convIds, userId],
    );
    return { count: parseInt(result[0]?.count ?? '0') };
  }
}
