import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

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
            toggleActive: jest.fn(),
            changeRole: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService) as jest.Mocked<UsersService>;
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

  describe('toggleActive', () => {
    it('should toggle user active status', async () => {
      const expected = { id: 1, is_active: false };
      service.toggleActive.mockResolvedValue(expected);

      const result = await controller.toggleActive(1, mockAdminReq);

      expect(service.toggleActive).toHaveBeenCalledWith(1, 99);
      expect(result).toEqual(expected);
    });
  });

  describe('changeRole', () => {
    it('should change user role', async () => {
      const expected = { id: 1, role: 'artist' };
      service.changeRole.mockResolvedValue(expected);

      const result = await controller.changeRole(1, { role: 'artist' }, mockAdminReq);

      expect(service.changeRole).toHaveBeenCalledWith(1, 'artist', 99);
      expect(result).toEqual(expected);
    });
  });
});
