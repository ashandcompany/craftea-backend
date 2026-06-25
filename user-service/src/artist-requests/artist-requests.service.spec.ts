import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ArtistRequestsService } from './artist-requests.service';
import {
  ArtistRequest,
  ArtistRequestStatus,
} from './entities/artist-request.entity';
import { ArtistRequestMessage } from './entities/artist-request-message.entity';
import { User, UserRole } from '../users/entities/user.entity';

describe('ArtistRequestsService', () => {
  let service: ArtistRequestsService;
  let requestsRepo: jest.Mocked<Repository<ArtistRequest>>;
  let messagesRepo: jest.Mocked<Repository<ArtistRequestMessage>>;
  let usersRepo: jest.Mocked<Repository<User>>;

  const mockBuyerUser: User = {
    id: 1,
    role: UserRole.BUYER,
    firstname: 'Alice',
    lastname: 'Dupont',
    email: 'alice@example.com',
    password: 'hashed',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    addresses: [],
    logs: [],
  };

  const mockRequest: ArtistRequest = {
    id: 10,
    user_id: 1,
    status: ArtistRequestStatus.PENDING,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    messages: [],
  };

  const mockMessage: ArtistRequestMessage = {
    id: 100,
    request_id: 10,
    request: mockRequest,
    sender_role: 'user',
    sender_id: 1,
    content: 'Je veux devenir artisan',
    created_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtistRequestsService,
        {
          provide: getRepositoryToken(ArtistRequest),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ArtistRequestMessage),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ArtistRequestsService>(ArtistRequestsService);
    requestsRepo = module.get(getRepositoryToken(ArtistRequest)) as jest.Mocked<
      Repository<ArtistRequest>
    >;
    messagesRepo = module.get(
      getRepositoryToken(ArtistRequestMessage),
    ) as jest.Mocked<Repository<ArtistRequestMessage>>;
    usersRepo = module.get(getRepositoryToken(User)) as jest.Mocked<
      Repository<User>
    >;
  });

  describe('submit', () => {
    it('should submit a new artist request', async () => {
      usersRepo.findOne
        .mockResolvedValueOnce(mockBuyerUser)
        .mockResolvedValueOnce({
          id: 1,
          firstname: 'Alice',
          lastname: 'Dupont',
          email: 'alice@example.com',
        } as User);
      requestsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockRequest, messages: [mockMessage] });
      requestsRepo.create.mockReturnValue(mockRequest);
      requestsRepo.save.mockResolvedValue(mockRequest);
      messagesRepo.create.mockReturnValue(mockMessage);
      messagesRepo.save.mockResolvedValue(mockMessage);

      const result = await service.submit(1, 'Je veux devenir artisan');

      expect(requestsRepo.create).toHaveBeenCalledWith({ user_id: 1 });
      expect(messagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Je veux devenir artisan',
          sender_role: 'user',
          sender_id: 1,
        }),
      );
      expect(result).toHaveProperty('id', 10);
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.submit(999, 'content')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user is not a buyer', async () => {
      usersRepo.findOne.mockResolvedValue({
        ...mockBuyerUser,
        role: UserRole.ARTIST,
      });

      await expect(service.submit(1, 'content')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if pending request already exists', async () => {
      usersRepo.findOne.mockResolvedValue(mockBuyerUser);
      requestsRepo.findOne.mockResolvedValue(mockRequest);

      await expect(service.submit(1, 'content')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getMyRequest', () => {
    it('should return the most recent request with sorted messages', async () => {
      const msg1 = { ...mockMessage, created_at: new Date('2024-01-02') };
      const msg2 = {
        ...mockMessage,
        id: 101,
        created_at: new Date('2024-01-01'),
      };
      const requestWithMessages = {
        ...mockRequest,
        messages: [msg1, msg2],
      };
      requestsRepo.findOne.mockResolvedValue(requestWithMessages);

      const result = await service.getMyRequest(1);

      expect(requestsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 1 } }),
      );
      expect(
        result!.messages[0].created_at <= result!.messages[1].created_at,
      ).toBe(true);
    });

    it('should return null if no request found', async () => {
      requestsRepo.findOne.mockResolvedValue(null);

      const result = await service.getMyRequest(999);

      expect(result).toBeNull();
    });
  });

  describe('addUserMessage', () => {
    it('should add a message to an active request', async () => {
      usersRepo.findOne.mockResolvedValue(mockBuyerUser);
      requestsRepo.findOne.mockResolvedValue({ ...mockRequest });
      messagesRepo.create.mockReturnValue(mockMessage);
      messagesRepo.save.mockResolvedValue(mockMessage);

      const result = await service.addUserMessage(1, 'New message');

      expect(messagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'New message',
          sender_role: 'user',
        }),
      );
      expect(result).toEqual(mockMessage);
    });

    it('should change status to PENDING if currently INFO_REQUESTED', async () => {
      const infoRequestedReq = {
        ...mockRequest,
        status: ArtistRequestStatus.INFO_REQUESTED,
      };
      usersRepo.findOne.mockResolvedValue(mockBuyerUser);
      requestsRepo.findOne.mockResolvedValue(infoRequestedReq);
      messagesRepo.create.mockReturnValue(mockMessage);
      messagesRepo.save.mockResolvedValue(mockMessage);
      requestsRepo.save.mockResolvedValue({
        ...infoRequestedReq,
        status: ArtistRequestStatus.PENDING,
      });

      await service.addUserMessage(1, 'Reply');

      expect(requestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ArtistRequestStatus.PENDING }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.addUserMessage(999, 'msg')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not a buyer', async () => {
      usersRepo.findOne.mockResolvedValue({
        ...mockBuyerUser,
        role: UserRole.ARTIST,
      });

      await expect(service.addUserMessage(1, 'msg')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if no active request found', async () => {
      usersRepo.findOne.mockResolvedValue(mockBuyerUser);
      requestsRepo.findOne.mockResolvedValue(null);

      await expect(service.addUserMessage(1, 'msg')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adminList', () => {
    it('should return an empty array when no requests exist', async () => {
      requestsRepo.find.mockResolvedValue([]);

      const result = await service.adminList();

      expect(result).toEqual([]);
    });

    it('should return requests with user info', async () => {
      requestsRepo.find.mockResolvedValue([mockRequest]);
      usersRepo.find.mockResolvedValue([mockBuyerUser]);

      const result = await service.adminList();

      expect(result).toHaveLength(1);
      expect(result[0].user).toEqual({
        id: 1,
        firstname: 'Alice',
        lastname: 'Dupont',
        email: 'alice@example.com',
      });
    });

    it('should set user to null if not found in map', async () => {
      const orphanRequest = { ...mockRequest, user_id: 999 };
      requestsRepo.find.mockResolvedValue([orphanRequest]);
      usersRepo.find.mockResolvedValue([]);

      const result = await service.adminList();

      expect(result[0].user).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return request with user info and sorted messages', async () => {
      const msg1 = { ...mockMessage, created_at: new Date('2024-01-02') };
      const msg2 = {
        ...mockMessage,
        id: 101,
        created_at: new Date('2024-01-01'),
      };
      requestsRepo.findOne.mockResolvedValue({
        ...mockRequest,
        messages: [msg1, msg2],
      });
      usersRepo.findOne.mockResolvedValue({
        id: 1,
        firstname: 'Alice',
        lastname: 'Dupont',
        email: 'alice@example.com',
      } as User);

      const result = await service.getById(10);

      expect(result.id).toBe(10);
      expect(result.user).toEqual(
        expect.objectContaining({ email: 'alice@example.com' }),
      );
      expect(
        result.messages[0].created_at <= result.messages[1].created_at,
      ).toBe(true);
    });

    it('should throw NotFoundException if request not found', async () => {
      requestsRepo.findOne.mockResolvedValue(null);

      await expect(service.getById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminAddMessage', () => {
    it('should add an admin message and set status to INFO_REQUESTED', async () => {
      requestsRepo.findOne.mockResolvedValue({ ...mockRequest });
      const adminMessage = { ...mockMessage, sender_role: 'admin' as const };
      messagesRepo.create.mockReturnValue(adminMessage);
      messagesRepo.save.mockResolvedValue(adminMessage);
      requestsRepo.save.mockResolvedValue({
        ...mockRequest,
        status: ArtistRequestStatus.INFO_REQUESTED,
      });

      const result = await service.adminAddMessage(
        10,
        99,
        "Fournissez plus d'infos",
      );

      expect(messagesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sender_role: 'admin', sender_id: 99 }),
      );
      expect(requestsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ArtistRequestStatus.INFO_REQUESTED }),
      );
      expect(result).toEqual(adminMessage);
    });

    it('should throw NotFoundException if request not found', async () => {
      requestsRepo.findOne.mockResolvedValue(null);

      await expect(service.adminAddMessage(999, 99, 'msg')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if request is already closed', async () => {
      requestsRepo.findOne.mockResolvedValue({
        ...mockRequest,
        status: ArtistRequestStatus.APPROVED,
      });

      await expect(service.adminAddMessage(10, 99, 'msg')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if request is rejected', async () => {
      requestsRepo.findOne.mockResolvedValue({
        ...mockRequest,
        status: ArtistRequestStatus.REJECTED,
      });

      await expect(service.adminAddMessage(10, 99, 'msg')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('adminDecide', () => {
    it('should approve the request and update user role to ARTIST', async () => {
      requestsRepo.findOne.mockResolvedValue({ ...mockRequest });
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      requestsRepo.save.mockResolvedValue({
        ...mockRequest,
        status: ArtistRequestStatus.APPROVED,
      });

      const result = await service.adminDecide(10, 99, 'approve');

      expect(usersRepo.update).toHaveBeenCalledWith(1, {
        role: UserRole.ARTIST,
      });
      expect(result).toEqual({ id: 10, status: ArtistRequestStatus.APPROVED });
    });

    it('should reject the request without changing user role', async () => {
      requestsRepo.findOne.mockResolvedValue({ ...mockRequest });
      requestsRepo.save.mockResolvedValue({
        ...mockRequest,
        status: ArtistRequestStatus.REJECTED,
      });

      const result = await service.adminDecide(10, 99, 'reject');

      expect(usersRepo.update).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 10, status: ArtistRequestStatus.REJECTED });
    });

    it('should throw NotFoundException if request not found', async () => {
      requestsRepo.findOne.mockResolvedValue(null);

      await expect(service.adminDecide(999, 99, 'approve')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if request is already approved', async () => {
      requestsRepo.findOne.mockResolvedValue({
        ...mockRequest,
        status: ArtistRequestStatus.APPROVED,
      });

      await expect(service.adminDecide(10, 99, 'reject')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if request is already rejected', async () => {
      requestsRepo.findOne.mockResolvedValue({
        ...mockRequest,
        status: ArtistRequestStatus.REJECTED,
      });

      await expect(service.adminDecide(10, 99, 'approve')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
