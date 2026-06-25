import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { MessagingEventsPublisher } from './messaging-events.publisher';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

describe('MessagingService', () => {
  let service: MessagingService;
  let conversationsRepo: jest.Mocked<Repository<Conversation>>;
  let messagesRepo: jest.Mocked<Repository<Message>>;
  let dataSource: jest.Mocked<DataSource>;
  let eventsPublisher: jest.Mocked<MessagingEventsPublisher>;

  const mockConv: Conversation = {
    id: 1,
    buyer_id: 100,
    artist_id: 200,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    messages: [],
  };

  const mockMsg: Message = {
    id: 1,
    conversation_id: 1,
    sender_id: 100,
    content: 'Hello!',
    read_at: null,
    created_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, fallback: string) => fallback),
          },
        },
        {
          provide: MessagingEventsPublisher,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
    conversationsRepo = module.get(
      getRepositoryToken(Conversation),
    ) as jest.Mocked<Repository<Conversation>>;
    messagesRepo = module.get(getRepositoryToken(Message)) as jest.Mocked<
      Repository<Message>
    >;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
    eventsPublisher = module.get(
      MessagingEventsPublisher,
    ) as jest.Mocked<MessagingEventsPublisher>;
  });

  describe('getOrCreate', () => {
    it('should return existing conversation id', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);

      const result = await service.getOrCreate(100, 200);

      expect(result).toEqual({ id: 1 });
      expect(conversationsRepo.save).not.toHaveBeenCalled();
    });

    it('should create a new conversation when none exists', async () => {
      conversationsRepo.findOne.mockResolvedValue(null);
      conversationsRepo.create.mockReturnValue(mockConv);
      conversationsRepo.save.mockResolvedValue(mockConv);

      const result = await service.getOrCreate(100, 200);

      expect(conversationsRepo.create).toHaveBeenCalledWith({
        buyer_id: 100,
        artist_id: 200,
      });
      expect(result).toEqual({ id: 1 });
    });

    it('should throw BadRequestException when user messages themselves', async () => {
      await expect(service.getOrCreate(100, 100)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listConversations', () => {
    it('should return empty array when user has no conversations', async () => {
      conversationsRepo.find.mockResolvedValue([]);

      const result = await service.listConversations(100);

      expect(result).toEqual([]);
    });

    it('should return conversations with last message and unread count', async () => {
      conversationsRepo.find.mockResolvedValue([mockConv]);
      dataSource.query
        .mockResolvedValueOnce([
          {
            conversation_id: 1,
            content: 'Last message',
            created_at: new Date('2026-01-01'),
            sender_id: 100,
          },
        ])
        .mockResolvedValueOnce([{ conversation_id: 1, count: '2' }]);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 200, firstname: 'Jane', lastname: 'Smith' }),
      }) as any;

      const result = await service.listConversations(100);

      expect(result).toHaveLength(1);
      expect(result[0].last_message).toBe('Last message');
      expect(result[0].unread_count).toBe(2);
    });

    it('should return null last message when no messages in conversation', async () => {
      conversationsRepo.find.mockResolvedValue([mockConv]);
      dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;

      const result = await service.listConversations(100);

      expect(result[0].last_message).toBeNull();
      expect(result[0].unread_count).toBe(0);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages for a conversation', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);
      messagesRepo.findAndCount.mockResolvedValue([[mockMsg], 1]);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 200, firstname: 'Jane', lastname: 'S' }),
      }) as any;

      const result = await service.getMessages(100, 1, 1, 50);

      expect(messagesRepo.findAndCount).toHaveBeenCalledWith({
        where: { conversation_id: 1 },
        order: { created_at: 'ASC' },
        skip: 0,
        take: 50,
      });
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      conversationsRepo.findOne.mockResolvedValue(null);

      await expect(service.getMessages(100, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);

      await expect(service.getMessages(999, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('sendMessage', () => {
    it('should send a message and return it', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);
      messagesRepo.create.mockReturnValue(mockMsg);
      messagesRepo.save.mockResolvedValue(mockMsg);
      conversationsRepo.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });
      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;

      const result = await service.sendMessage(100, 1, 'Hello!');

      expect(messagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversation_id: 1,
          sender_id: 100,
          content: 'Hello!',
        }),
      );
      expect(result).toEqual(mockMsg);
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      conversationsRepo.findOne.mockResolvedValue(null);

      await expect(service.sendMessage(100, 999, 'Hello!')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);

      await expect(service.sendMessage(999, 1, 'Hello!')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when content is empty', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);

      await expect(service.sendMessage(100, 1, '   ')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('markRead', () => {
    it('should mark messages as read', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);
      dataSource.query.mockResolvedValue([]);

      const result = await service.markRead(100, 1);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE messages'),
        [1, 100],
      );
      expect(result).toEqual({ ok: true });
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      conversationsRepo.findOne.mockResolvedValue(null);

      await expect(service.markRead(100, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not a participant', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);

      await expect(service.markRead(999, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return 0 when user has no conversations', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await service.getUnreadCount(100);

      expect(result).toEqual({ count: 0 });
    });

    it('should return unread count', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ conversation_id: 1 }, { conversation_id: 2 }])
        .mockResolvedValueOnce([{ count: '5' }]);

      const result = await service.getUnreadCount(100);

      expect(result).toEqual({ count: 5 });
    });
  });

  describe('eventsPublisher integration', () => {
    it('should call eventsPublisher.publish when notifying recipient', async () => {
      conversationsRepo.findOne.mockResolvedValue(mockConv);
      messagesRepo.create.mockReturnValue(mockMsg);
      messagesRepo.save.mockResolvedValue(mockMsg);
      conversationsRepo.update.mockResolvedValue({
        affected: 1,
        raw: [],
        generatedMaps: [],
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 200,
          email: 'artist@example.com',
          firstname: 'Jane',
          lastname: 'Smith',
        }),
      }) as any;

      await service.sendMessage(100, 1, 'Hello artist!');

      await new Promise((r) => setTimeout(r, 10));

      expect(eventsPublisher.publish).toHaveBeenCalledWith(
        'message.received',
        expect.objectContaining({ recipientEmail: 'artist@example.com' }),
      );
    });
  });
});
