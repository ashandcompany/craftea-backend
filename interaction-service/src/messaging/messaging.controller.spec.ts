import { Test, TestingModule } from '@nestjs/testing';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

describe('MessagingController', () => {
  let controller: MessagingController;
  let service: jest.Mocked<MessagingService>;

  const mockReq = { user: { id: 100 } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        {
          provide: MessagingService,
          useValue: {
            getUnreadCount: jest.fn(),
            listConversations: jest.fn(),
            getOrCreate: jest.fn(),
            getMessages: jest.fn(),
            sendMessage: jest.fn(),
            markRead: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MessagingController>(MessagingController);
    service = module.get(MessagingService) as jest.Mocked<MessagingService>;
  });

  describe('getUnreadCount', () => {
    it('should return unread count for current user', async () => {
      service.getUnreadCount.mockResolvedValue({ count: 3 });

      const result = await controller.getUnreadCount(mockReq);

      expect(service.getUnreadCount).toHaveBeenCalledWith(100);
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('listConversations', () => {
    it('should return conversations for current user', async () => {
      const conversations = [{ id: 1, buyer_id: 100, artist_id: 200 }];
      service.listConversations.mockResolvedValue(conversations as any);

      const result = await controller.listConversations(mockReq);

      expect(service.listConversations).toHaveBeenCalledWith(100);
      expect(result).toEqual(conversations);
    });
  });

  describe('getOrCreate', () => {
    it('should get or create a conversation', async () => {
      service.getOrCreate.mockResolvedValue({ id: 1 });

      const result = await controller.getOrCreate(mockReq, 200);

      expect(service.getOrCreate).toHaveBeenCalledWith(100, 200);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('getMessages', () => {
    it('should return messages for a conversation', async () => {
      const messages = { total: 1, page: 1, limit: 50, data: [] };
      service.getMessages.mockResolvedValue(messages as any);

      const result = await controller.getMessages(mockReq, 1, 1, 50);

      expect(service.getMessages).toHaveBeenCalledWith(100, 1, 1, 50);
      expect(result).toEqual(messages);
    });
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      const msg = { id: 1, conversation_id: 1, sender_id: 100, content: 'Hi' };
      service.sendMessage.mockResolvedValue(msg as any);

      const result = await controller.sendMessage(mockReq, 1, {
        content: 'Hi',
      });

      expect(service.sendMessage).toHaveBeenCalledWith(100, 1, 'Hi');
      expect(result).toEqual(msg);
    });
  });

  describe('markRead', () => {
    it('should mark messages as read', async () => {
      service.markRead.mockResolvedValue({ ok: true });

      const result = await controller.markRead(mockReq, 1);

      expect(service.markRead).toHaveBeenCalledWith(100, 1);
      expect(result).toEqual({ ok: true });
    });
  });
});
