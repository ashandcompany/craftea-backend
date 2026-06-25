import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ArtistRequest,
  ArtistRequestStatus,
} from './entities/artist-request.entity.js';
import { ArtistRequestMessage } from './entities/artist-request-message.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';

@Injectable()
export class ArtistRequestsService {
  constructor(
    @InjectRepository(ArtistRequest)
    private requestsRepo: Repository<ArtistRequest>,
    @InjectRepository(ArtistRequestMessage)
    private messagesRepo: Repository<ArtistRequestMessage>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async submit(userId: number, content: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== UserRole.BUYER) {
      throw new BadRequestException('Votre compte est déjà artiste ou admin');
    }

    const existing = await this.requestsRepo.findOne({
      where: [
        { user_id: userId, status: ArtistRequestStatus.PENDING },
        { user_id: userId, status: ArtistRequestStatus.INFO_REQUESTED },
      ],
    });
    if (existing)
      throw new ConflictException('Vous avez déjà une demande en cours');

    const artistRequest = this.requestsRepo.create({ user_id: userId });
    await this.requestsRepo.save(artistRequest);

    const message = this.messagesRepo.create({
      request_id: artistRequest.id,
      sender_role: 'user',
      sender_id: userId,
      content,
    });
    await this.messagesRepo.save(message);

    return this.getById(artistRequest.id);
  }

  async getMyRequest(userId: number) {
    const artistRequest = await this.requestsRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      relations: ['messages'],
    });
    if (!artistRequest) return null;
    artistRequest.messages.sort((a, b) => +a.created_at - +b.created_at);
    return artistRequest;
  }

  async addUserMessage(userId: number, content: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role !== UserRole.BUYER) {
      throw new ForbiddenException('Votre demande a déjà été traitée');
    }

    const artistRequest = await this.requestsRepo.findOne({
      where: [
        { user_id: userId, status: ArtistRequestStatus.PENDING },
        { user_id: userId, status: ArtistRequestStatus.INFO_REQUESTED },
      ],
    });
    if (!artistRequest) throw new NotFoundException('Aucune demande active');

    const message = this.messagesRepo.create({
      request_id: artistRequest.id,
      sender_role: 'user',
      sender_id: userId,
      content,
    });
    await this.messagesRepo.save(message);

    if (artistRequest.status === ArtistRequestStatus.INFO_REQUESTED) {
      artistRequest.status = ArtistRequestStatus.PENDING;
      await this.requestsRepo.save(artistRequest);
    }

    return message;
  }

  async adminList() {
    const requests = await this.requestsRepo.find({
      order: { updated_at: 'DESC' },
    });
    if (requests.length === 0) return [];

    const userIds = [...new Set(requests.map((r) => r.user_id))];
    const users = await this.usersRepo.find({ where: { id: In(userIds) } });
    const usersMap = Object.fromEntries(
      users.map((u) => [
        u.id,
        {
          id: u.id,
          firstname: u.firstname,
          lastname: u.lastname,
          email: u.email,
        },
      ]),
    );

    return requests.map((r) => ({ ...r, user: usersMap[r.user_id] ?? null }));
  }

  async getById(id: number) {
    const artistRequest = await this.requestsRepo.findOne({
      where: { id },
      relations: ['messages'],
    });
    if (!artistRequest) throw new NotFoundException('Demande introuvable');
    artistRequest.messages.sort((a, b) => +a.created_at - +b.created_at);

    const user = await this.usersRepo.findOne({
      where: { id: artistRequest.user_id },
      select: ['id', 'firstname', 'lastname', 'email'],
    });

    return { ...artistRequest, user: user ?? null };
  }

  async adminAddMessage(requestId: number, adminId: number, content: string) {
    const artistRequest = await this.requestsRepo.findOne({
      where: { id: requestId },
    });
    if (!artistRequest) throw new NotFoundException('Demande introuvable');
    if (
      artistRequest.status === ArtistRequestStatus.APPROVED ||
      artistRequest.status === ArtistRequestStatus.REJECTED
    ) {
      throw new BadRequestException('Cette demande est déjà close');
    }

    const message = this.messagesRepo.create({
      request_id: requestId,
      sender_role: 'admin',
      sender_id: adminId,
      content,
    });
    await this.messagesRepo.save(message);

    artistRequest.status = ArtistRequestStatus.INFO_REQUESTED;
    await this.requestsRepo.save(artistRequest);

    return message;
  }

  async adminDecide(
    requestId: number,
    adminId: number,
    action: 'approve' | 'reject',
  ): Promise<{ id: number; status: ArtistRequestStatus }> {
    const artistRequest = await this.requestsRepo.findOne({
      where: { id: requestId },
    });
    if (!artistRequest) throw new NotFoundException('Demande introuvable');
    if (
      artistRequest.status === ArtistRequestStatus.APPROVED ||
      artistRequest.status === ArtistRequestStatus.REJECTED
    ) {
      throw new BadRequestException('Cette demande est déjà close');
    }

    if (action === 'approve') {
      await this.usersRepo.update(artistRequest.user_id, {
        role: UserRole.ARTIST,
      });
      artistRequest.status = ArtistRequestStatus.APPROVED;
    } else {
      artistRequest.status = ArtistRequestStatus.REJECTED;
    }

    await this.requestsRepo.save(artistRequest);
    return { id: artistRequest.id, status: artistRequest.status };
  }
}
