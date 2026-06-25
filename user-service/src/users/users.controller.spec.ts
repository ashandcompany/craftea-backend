import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 1,
    role: UserRole.BUYER,
    firstname: 'Alice',
    lastname: 'Dupont',
    email: 'alice@example.com',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUserReq = { user: { id: 1, role: 'buyer' } };
  const mockAdminReq = { user: { id: 99, role: 'admin' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findPublicById: jest.fn(),
            update: jest.fn(),
            updateAvatar: jest.fn(),
            toggleActive: jest.fn(),
            selfDeactivate: jest.fn(),
            changeRole: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => {
              if (key === 'INTERNAL_SERVICE_TOKEN') return 'secret-token';
              return def;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService) as jest.Mocked<UsersService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      service.findAll.mockResolvedValue([mockUser] as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findPublicById', () => {
    it('should return public user info', async () => {
      const publicUser = { id: 1, firstname: 'Alice', lastname: 'Dupont' };
      service.findPublicById.mockResolvedValue(publicUser as any);

      const result = await controller.findPublicById(1);

      expect(service.findPublicById).toHaveBeenCalledWith(1);
      expect(result).toEqual(publicUser);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      service.findById.mockResolvedValue(mockUser as any);

      const result = await controller.findById(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const dto = { firstname: 'Bob' };
      const updated = { ...mockUser, firstname: 'Bob' };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(1, dto, mockUserReq);

      expect(service.update).toHaveBeenCalledWith(1, dto, mockUserReq.user);
      expect(result.firstname).toBe('Bob');
    });
  });

  describe('updateAvatar', () => {
    it('should upload the avatar', async () => {
      const mockFile = { originalname: 'avatar.jpg' } as Express.Multer.File;
      const updated = { ...mockUser, avatar_url: 'new-key.jpg' };
      service.updateAvatar.mockResolvedValue(updated as any);

      const result = await controller.updateAvatar(1, mockFile, mockUserReq);

      expect(service.updateAvatar).toHaveBeenCalledWith(
        1,
        mockFile,
        mockUserReq.user,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('toggleActive', () => {
    it('should toggle user active status', async () => {
      const expected = { id: 1, is_active: false };
      service.toggleActive.mockResolvedValue(expected);

      const result = await controller.toggleActive(1, mockAdminReq);

      expect(service.toggleActive).toHaveBeenCalledWith(1, 99);
      expect(result).toEqual(expected);
    });
  });

  describe('deactivateSelf', () => {
    it('should deactivate the current user and return ok', async () => {
      service.selfDeactivate.mockResolvedValue(undefined);

      const result = await controller.deactivateSelf(mockUserReq);

      expect(service.selfDeactivate).toHaveBeenCalledWith(1);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('changeRole', () => {
    it('should change user role', async () => {
      const expected = { id: 1, role: UserRole.ARTIST };
      service.changeRole.mockResolvedValue(expected);

      const result = await controller.changeRole(
        1,
        { role: 'artist' },
        mockAdminReq,
      );

      expect(service.changeRole).toHaveBeenCalledWith(1, 'artist', 99);
      expect(result).toEqual(expected);
    });
  });

  describe('findInternalById', () => {
    it('should return user projection with valid service token', async () => {
      service.findById.mockResolvedValue(mockUser as any);

      const result = await controller.findInternalById(1, 'secret-token');

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstname: mockUser.firstname,
        lastname: mockUser.lastname,
      });
    });

    it('should throw ForbiddenException with invalid service token', async () => {
      await expect(
        controller.findInternalById(1, 'wrong-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with missing service token', async () => {
      await expect(
        controller.findInternalById(1, undefined as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when INTERNAL_SERVICE_TOKEN is not configured', async () => {
      configService.get.mockReturnValue('');

      await expect(
        controller.findInternalById(1, 'secret-token'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
