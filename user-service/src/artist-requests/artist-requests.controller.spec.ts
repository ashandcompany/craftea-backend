import { Test, TestingModule } from '@nestjs/testing';
import { ArtistRequestsController } from './artist-requests.controller';
import { ArtistRequestsService } from './artist-requests.service';
import { ArtistRequestStatus } from './entities/artist-request.entity';

describe('ArtistRequestsController', () => {
  let controller: ArtistRequestsController;
  let service: jest.Mocked<ArtistRequestsService>;

  const mockUserReq = { user: { id: 1, role: 'buyer' } };
  const mockAdminReq = { user: { id: 99, role: 'admin' } };

  const mockRequest = {
    id: 10,
    user_id: 1,
    status: ArtistRequestStatus.PENDING,
    messages: [],
    created_at: new Date(),
    updated_at: new Date(),
    user: {
      id: 1,
      firstname: 'Alice',
      lastname: 'Dupont',
      email: 'alice@example.com',
    },
  };

  const mockMessage = {
    id: 100,
    request_id: 10,
    sender_role: 'user' as const,
    sender_id: 1,
    content: 'Je veux devenir artisan',
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArtistRequestsController],
      providers: [
        {
          provide: ArtistRequestsService,
          useValue: {
            submit: jest.fn(),
            getMyRequest: jest.fn(),
            addUserMessage: jest.fn(),
            adminList: jest.fn(),
            getById: jest.fn(),
            adminAddMessage: jest.fn(),
            adminDecide: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ArtistRequestsController>(ArtistRequestsController);
    service = module.get(
      ArtistRequestsService,
    ) as jest.Mocked<ArtistRequestsService>;
  });

  describe('submit', () => {
    it('should submit a new artist request', async () => {
      service.submit.mockResolvedValue(mockRequest as any);
      const dto = { content: 'Je veux devenir artisan' };

      const result = await controller.submit(mockUserReq, dto);

      expect(service.submit).toHaveBeenCalledWith(1, 'Je veux devenir artisan');
      expect(result).toEqual(mockRequest);
    });
  });

  describe('getMyRequest', () => {
    it('should return the current user request', async () => {
      service.getMyRequest.mockResolvedValue(mockRequest as any);

      const result = await controller.getMyRequest(mockUserReq);

      expect(service.getMyRequest).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockRequest);
    });

    it('should return null if no request found', async () => {
      service.getMyRequest.mockResolvedValue(null);

      const result = await controller.getMyRequest(mockUserReq);

      expect(result).toBeNull();
    });
  });

  describe('addUserMessage', () => {
    it('should add a user message to the active request', async () => {
      service.addUserMessage.mockResolvedValue(mockMessage as any);
      const dto = { content: 'Voici mes infos' };

      const result = await controller.addUserMessage(mockUserReq, dto);

      expect(service.addUserMessage).toHaveBeenCalledWith(1, 'Voici mes infos');
      expect(result).toEqual(mockMessage);
    });
  });

  describe('adminList', () => {
    it('should return all requests', async () => {
      service.adminList.mockResolvedValue([mockRequest] as any);

      const result = await controller.adminList();

      expect(service.adminList).toHaveBeenCalled();
      expect(result).toEqual([mockRequest]);
    });
  });

  describe('adminGetById', () => {
    it('should return a specific request by id', async () => {
      service.getById.mockResolvedValue(mockRequest as any);

      const result = await controller.adminGetById(10);

      expect(service.getById).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockRequest);
    });
  });

  describe('adminAddMessage', () => {
    it('should add an admin message to the request', async () => {
      const adminMessage = { ...mockMessage, sender_role: 'admin' as const };
      service.adminAddMessage.mockResolvedValue(adminMessage as any);
      const dto = { content: 'Fournissez des preuves' };

      const result = await controller.adminAddMessage(10, dto, mockAdminReq);

      expect(service.adminAddMessage).toHaveBeenCalledWith(
        10,
        99,
        'Fournissez des preuves',
      );
      expect(result).toEqual(adminMessage);
    });
  });

  describe('adminDecide', () => {
    it('should approve the request', async () => {
      const expected = { id: 10, status: ArtistRequestStatus.APPROVED };
      service.adminDecide.mockResolvedValue(expected);
      const dto = { action: 'approve' as const };

      const result = await controller.adminDecide(10, dto, mockAdminReq);

      expect(service.adminDecide).toHaveBeenCalledWith(10, 99, 'approve');
      expect(result).toEqual(expected);
    });

    it('should reject the request', async () => {
      const expected = { id: 10, status: ArtistRequestStatus.REJECTED };
      service.adminDecide.mockResolvedValue(expected);
      const dto = { action: 'reject' as const };

      const result = await controller.adminDecide(10, dto, mockAdminReq);

      expect(service.adminDecide).toHaveBeenCalledWith(10, 99, 'reject');
      expect(result).toEqual(expected);
    });
  });
});
