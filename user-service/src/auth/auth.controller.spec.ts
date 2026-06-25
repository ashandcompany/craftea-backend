import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '../users/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  const mockUserData = {
    id: 1,
    email: 'alice@example.com',
    firstname: 'Alice',
    lastname: 'Dupont',
    role: UserRole.BUYER,
    is_active: true,
    avatar_url: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAuthResult = {
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    user: mockUserData,
  };

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  beforeEach(async () => {
    mockRes.cookie.mockReset();
    mockRes.clearCookie.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            loginWithGoogle: jest.fn(),
            refresh: jest.fn(),
            me: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            changePassword: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => {
              if (key === 'NODE_ENV') return 'test';
              return def;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  describe('register', () => {
    it('should register a user and set cookies', async () => {
      service.register.mockResolvedValue(mockAuthResult);
      const dto = {
        firstname: 'Alice',
        lastname: 'Dupont',
        email: 'alice@example.com',
        password: 'password123',
      };

      const result = await controller.register(dto, mockRes as any);

      expect(service.register).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'accessToken',
        'access_token',
        expect.any(Object),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh_token',
        expect.any(Object),
      );
      expect(result).toEqual({ user: mockUserData });
    });
  });

  describe('login', () => {
    it('should login a user and set cookies', async () => {
      service.login.mockResolvedValue(mockAuthResult);
      const dto = { email: 'alice@example.com', password: 'password123' };

      const result = await controller.login(dto, mockRes as any);

      expect(service.login).toHaveBeenCalledWith(dto);
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ user: mockUserData });
    });
  });

  describe('googleLogin', () => {
    it('should handle Google login and set cookies', async () => {
      service.loginWithGoogle.mockResolvedValue(mockAuthResult);
      const dto = { credential: 'google_id_token' };

      const result = await controller.googleLogin(dto, mockRes as any);

      expect(service.loginWithGoogle).toHaveBeenCalledWith('google_id_token');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ user: mockUserData });
    });
  });

  describe('refresh', () => {
    it('should refresh the access token', async () => {
      const mockReq = { cookies: { refreshToken: 'valid_refresh_token' } };
      service.refresh.mockResolvedValue({ accessToken: 'new_access_token' });

      const result = await controller.refresh(mockReq as any, mockRes as any);

      expect(service.refresh).toHaveBeenCalledWith('valid_refresh_token');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'accessToken',
        'new_access_token',
        expect.any(Object),
      );
      expect(result).toEqual({ ok: true });
    });

    it('should throw UnauthorizedException if refresh token is missing', async () => {
      const mockReq = { cookies: {} };

      await expect(
        controller.refresh(mockReq as any, mockRes as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if cookies are absent', async () => {
      const mockReq = {};

      await expect(
        controller.refresh(mockReq as any, mockRes as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear cookies and return ok', () => {
      const result = controller.logout(mockRes as any);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('accessToken', {
        path: '/',
      });
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/',
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('me', () => {
    it('should return the authenticated user', async () => {
      service.me.mockResolvedValue(mockUserData as any);
      const mockReq = { user: { id: 1 } };

      const result = await controller.me(mockReq);

      expect(service.me).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUserData);
    });

    it('should throw NotFoundException if user not found', async () => {
      service.me.mockResolvedValue(null as any);
      const mockReq = { user: { id: 999 } };

      await expect(controller.me(mockReq)).rejects.toThrow(NotFoundException);
    });
  });

  describe('forgotPassword', () => {
    it('should call forgotPassword and return ok', async () => {
      service.forgotPassword.mockResolvedValue(undefined);
      const dto = { email: 'alice@example.com' };

      const result = await controller.forgotPassword(dto);

      expect(service.forgotPassword).toHaveBeenCalledWith('alice@example.com');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('resetPassword', () => {
    it('should call resetPassword and return ok', async () => {
      service.resetPassword.mockResolvedValue(undefined);
      const dto = { token: 'raw_token', newPassword: 'newpass123' };

      const result = await controller.resetPassword(dto);

      expect(service.resetPassword).toHaveBeenCalledWith(
        'raw_token',
        'newpass123',
      );
      expect(result).toEqual({ ok: true });
    });
  });

  describe('changePassword', () => {
    it('should change password when passwords match', async () => {
      service.changePassword.mockResolvedValue(undefined);
      const dto = {
        currentPassword: 'current',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      };
      const mockReq = { user: { id: 1 } };

      const result = await controller.changePassword(dto, mockReq);

      expect(service.changePassword).toHaveBeenCalledWith(
        1,
        'current',
        'newpass123',
      );
      expect(result).toEqual({ ok: true });
    });

    it('should throw BadRequestException if passwords do not match', async () => {
      const dto = {
        currentPassword: 'current',
        newPassword: 'newpass123',
        confirmPassword: 'different',
      };
      const mockReq = { user: { id: 1 } };

      await expect(controller.changePassword(dto, mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
