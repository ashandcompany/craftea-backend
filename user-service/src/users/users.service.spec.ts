import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import { Log } from '../logs/entities/log.entity';
import { MinioService } from '../minio/minio.service';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: jest.Mocked<Repository<User>>;
  let logsRepo: jest.Mocked<Repository<Log>>;
  let minioService: jest.Mocked<MinioService>;

  const mockUser: User = {
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

  const mockLog: Log = {
    id: 1,
    user_id: 1,
    action: 'update_user',
    entity: 'user',
    entity_id: 1,
    created_at: new Date(),
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Log),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: MinioService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepo = module.get(getRepositoryToken(User)) as jest.Mocked<
      Repository<User>
    >;
    logsRepo = module.get(getRepositoryToken(Log)) as jest.Mocked<
      Repository<Log>
    >;
    minioService = module.get(MinioService) as jest.Mocked<MinioService>;
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      usersRepo.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(usersRepo.find).toHaveBeenCalled();
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPublicById', () => {
    it('should return public user info', async () => {
      const publicUser = {
        id: 1,
        firstname: 'Alice',
        lastname: 'Dupont',
      } as User;
      usersRepo.findOne.mockResolvedValue(publicUser);

      const result = await service.findPublicById(1);

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        select: ['id', 'firstname', 'lastname'],
      });
      expect(result).toEqual(publicUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.findPublicById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update own profile', async () => {
      const dto = { firstname: 'Bob' };
      const updated = { ...mockUser, firstname: 'Bob' };
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);
      usersRepo.findOne.mockResolvedValue(updated);

      const result = await service.update(1, dto, { id: 1, role: 'buyer' });

      expect(usersRepo.update).toHaveBeenCalledWith(1, dto);
      expect(logsRepo.create).toHaveBeenCalledWith({
        user_id: 1,
        action: 'update_user',
        entity: 'user',
        entity_id: 1,
      });
      expect(result.firstname).toBe('Bob');
    });

    it('should allow admin to update any user', async () => {
      const dto = { firstname: 'Updated' };
      const updated = { ...mockUser, firstname: 'Updated' };
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);
      usersRepo.findOne.mockResolvedValue(updated);

      const result = await service.update(1, dto, { id: 99, role: 'admin' });

      expect(result.firstname).toBe('Updated');
    });

    it('should throw ForbiddenException if non-admin updates another user', async () => {
      await expect(
        service.update(1, { firstname: 'X' }, { id: 99, role: 'buyer' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle user active status to false', async () => {
      usersRepo.findOne.mockResolvedValue({ ...mockUser, is_active: true });
      usersRepo.save.mockResolvedValue({ ...mockUser, is_active: false });
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      const result = await service.toggleActive(1, 99);

      expect(result).toEqual({ id: 1, is_active: false });
    });

    it('should toggle user active status to true', async () => {
      usersRepo.findOne.mockResolvedValue({ ...mockUser, is_active: false });
      usersRepo.save.mockResolvedValue({ ...mockUser, is_active: true });
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      const result = await service.toggleActive(1, 99);

      expect(result).toEqual({ id: 1, is_active: true });
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleActive(999, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('changeRole', () => {
    it('should change user role', async () => {
      usersRepo.findOne.mockResolvedValue({ ...mockUser });
      usersRepo.save.mockResolvedValue({ ...mockUser, role: UserRole.ARTIST });
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      const result = await service.changeRole(1, 'artist', 99);

      expect(result).toEqual({ id: 1, role: 'artist' });
    });

    it('should throw NotFoundException if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.changeRole(999, 'admin', 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAvatar', () => {
    const mockFile = {
      originalname: 'avatar.jpg',
      buffer: Buffer.from(''),
      mimetype: 'image/jpeg',
      size: 100,
    } as Express.Multer.File;

    it('should throw ForbiddenException if non-owner non-admin', async () => {
      await expect(
        service.updateAvatar(1, mockFile, { id: 2, role: 'buyer' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if file is missing', async () => {
      await expect(
        service.updateAvatar(1, null as any, { id: 1, role: 'buyer' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete old avatar and upload new one', async () => {
      const userWithAvatar = { ...mockUser, avatar_url: 'old-key.jpg' };
      usersRepo.findOne.mockResolvedValue(userWithAvatar);
      minioService.deleteFile.mockResolvedValue(undefined);
      minioService.uploadFile.mockResolvedValue('new-key.jpg');
      usersRepo.save.mockResolvedValue({
        ...userWithAvatar,
        avatar_url: 'new-key.jpg',
      });

      const result = await service.updateAvatar(1, mockFile, {
        id: 1,
        role: 'buyer',
      });

      expect(minioService.deleteFile).toHaveBeenCalledWith('old-key.jpg');
      expect(minioService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(result.avatar_url).toBe('new-key.jpg');
    });

    it('should upload avatar without deleting when no previous avatar', async () => {
      const userWithoutAvatar = { ...mockUser, avatar_url: undefined };
      usersRepo.findOne.mockResolvedValue(userWithoutAvatar);
      minioService.uploadFile.mockResolvedValue('new-key.jpg');
      usersRepo.save.mockResolvedValue({
        ...userWithoutAvatar,
        avatar_url: 'new-key.jpg',
      });

      const result = await service.updateAvatar(1, mockFile, {
        id: 1,
        role: 'buyer',
      });

      expect(minioService.deleteFile).not.toHaveBeenCalled();
      expect(result.avatar_url).toBe('new-key.jpg');
    });

    it('should allow admin to update any user avatar', async () => {
      usersRepo.findOne.mockResolvedValue({ ...mockUser });
      minioService.uploadFile.mockResolvedValue('new-key.jpg');
      usersRepo.save.mockResolvedValue({
        ...mockUser,
        avatar_url: 'new-key.jpg',
      });

      const result = await service.updateAvatar(1, mockFile, {
        id: 99,
        role: 'admin',
      });

      expect(result.avatar_url).toBe('new-key.jpg');
    });
  });

  describe('selfDeactivate', () => {
    it('should anonymize PII, delete avatar from MinIO, and log delete_account', async () => {
      const userWithAvatar = { ...mockUser, avatar_url: 'avatar-key.jpg' };
      usersRepo.findOne.mockResolvedValue(userWithAvatar);
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      minioService.deleteFile.mockResolvedValue(undefined);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      await service.selfDeactivate(1);

      expect(minioService.deleteFile).toHaveBeenCalledWith('avatar-key.jpg');
      expect(usersRepo.update).toHaveBeenCalledWith(1, {
        email: 'deleted_1@craftea.fr',
        firstname: 'Utilisateur',
        lastname: 'supprimé',
        avatar_url: null,
        reset_password_token: null,
        reset_password_expires: null,
        is_active: false,
      });
      expect(logsRepo.create).toHaveBeenCalledWith({
        user_id: 1,
        action: 'delete_account',
        entity: 'user',
        entity_id: 1,
      });
      expect(logsRepo.save).toHaveBeenCalled();
    });

    it('should skip MinIO deletion when user has no avatar', async () => {
      const userWithoutAvatar = { ...mockUser, avatar_url: undefined };
      usersRepo.findOne.mockResolvedValue(userWithoutAvatar);
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      await service.selfDeactivate(1);

      expect(minioService.deleteFile).not.toHaveBeenCalled();
      expect(usersRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          email: 'deleted_1@craftea.fr',
          is_active: false,
        }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.selfDeactivate(999)).rejects.toThrow(
        NotFoundException,
      );
      expect(usersRepo.update).not.toHaveBeenCalled();
    });
  });
});
