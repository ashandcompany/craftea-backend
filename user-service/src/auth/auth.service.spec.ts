import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));
import { User, UserRole } from '../users/entities/user.entity';
import { Log } from '../logs/entities/log.entity';
import { EmailService } from '../email/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: jest.Mocked<Repository<User>>;
  let logsRepo: jest.Mocked<Repository<Log>>;
  let jwtService: jest.Mocked<JwtService>;
  let emailService: jest.Mocked<EmailService>;
  let mockQB: any;

  const mockUser: User = {
    id: 1,
    role: UserRole.BUYER,
    firstname: 'Alice',
    lastname: 'Dupont',
    email: 'alice@example.com',
    password: 'hashed_password',
    is_active: true,
    avatar_url: undefined,
    reset_password_token: undefined,
    reset_password_expires: undefined,
    created_at: new Date(),
    updated_at: new Date(),
    addresses: [],
    logs: [],
  };

  const mockLog: Log = {
    id: 1,
    user_id: 1,
    action: 'register',
    entity: 'user',
    entity_id: 1,
    created_at: new Date(),
    user: mockUser,
  };

  beforeEach(async () => {
    mockQB = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue(mockQB),
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
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => {
              const cfg: Record<string, any> = {
                JWT_SECRET: 'jwt_secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_SECRET: 'refresh_secret',
                JWT_REFRESH_EXPIRES_IN: '7d',
                GOOGLE_CLIENT_ID: undefined,
                APP_URL: 'http://localhost:3000',
                RESEND_API_KEY: 'placeholder',
              };
              return key in cfg ? cfg[key] : def;
            }),
          },
        },
        {
          provide: EmailService,
          useValue: { send: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepo = module.get(getRepositoryToken(User)) as jest.Mocked<
      Repository<User>
    >;
    logsRepo = module.get(getRepositoryToken(Log)) as jest.Mocked<
      Repository<Log>
    >;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    emailService = module.get(EmailService) as jest.Mocked<EmailService>;

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      usersRepo.create.mockReturnValue(mockUser);
      usersRepo.save.mockResolvedValue(mockUser);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      const result = await service.register({
        firstname: 'Alice',
        lastname: 'Dupont',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
      expect(result.accessToken).toBe('mock_token');
      expect(result.refreshToken).toBe('mock_token');
      expect(result.user.email).toBe('alice@example.com');
    });

    it('should throw ConflictException if email already exists', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          firstname: 'Alice',
          lastname: 'Dupont',
          email: 'alice@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      mockQB.getOne.mockResolvedValue(mockUser);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      const result = await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock_token');
      expect(result.user.email).toBe('alice@example.com');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockQB.getOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if account is deactivated', async () => {
      mockQB.getOne.mockResolvedValue({ ...mockUser, is_active: false });

      await expect(
        service.login({ email: 'alice@example.com', password: 'pass' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockQB.getOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return a new access token with valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ id: 1 } as any);
      usersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.refresh('valid_refresh_token');

      expect(result.accessToken).toBe('mock_token');
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('bad_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jwtService.verify.mockReturnValue({ id: 999 } as any);
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('valid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      jwtService.verify.mockReturnValue({ id: 1 } as any);
      usersRepo.findOne.mockResolvedValue({ ...mockUser, is_active: false });

      await expect(service.refresh('valid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('me', () => {
    it('should return the current user', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.me(1);

      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.me(999);

      expect(result).toBeNull();
    });
  });

  describe('forgotPassword', () => {
    it('should silently return if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.forgotPassword('unknown@example.com'),
      ).resolves.toBeUndefined();

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should save reset token and send email if user found', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      emailService.send.mockResolvedValue(undefined);

      await service.forgotPassword('alice@example.com');

      expect(usersRepo.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          reset_password_token: expect.any(String),
          reset_password_expires: expect.any(Date),
        }),
      );
      expect(emailService.send).toHaveBeenCalledWith(
        'alice@example.com',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset the password with a valid token', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      mockQB.getOne.mockResolvedValue({
        ...mockUser,
        reset_password_token: 'some_hash',
        reset_password_expires: future,
      });
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);

      await expect(
        service.resetPassword('raw_token', 'newpassword123'),
      ).resolves.toBeUndefined();

      expect(usersRepo.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          password: 'hashed_password',
          reset_password_token: null,
          reset_password_expires: null,
        }),
      );
    });

    it('should throw BadRequestException if token is not found', async () => {
      mockQB.getOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad_token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is expired', async () => {
      const past = new Date(Date.now() - 1000);
      mockQB.getOne.mockResolvedValue({
        ...mockUser,
        reset_password_token: 'some_hash',
        reset_password_expires: past,
      });

      await expect(
        service.resetPassword('raw_token', 'newpassword'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      mockQB.getOne.mockResolvedValue(mockUser);
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      await expect(
        service.changePassword(1, 'current_pass', 'newpassword123'),
      ).resolves.toBeUndefined();

      expect(usersRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ password: 'hashed_password' }),
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockQB.getOne.mockResolvedValue(null);

      await expect(
        service.changePassword(999, 'pass', 'newpass123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if current password is wrong', async () => {
      mockQB.getOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(1, 'wrong_pass', 'newpass123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if new password is too short', async () => {
      mockQB.getOne.mockResolvedValue(mockUser);

      await expect(
        service.changePassword(1, 'current_pass', 'short'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('loginWithGoogle', () => {
    const mockPayload = {
      email: 'google@example.com',
      given_name: 'Google',
      family_name: 'User',
      picture: 'https://picture.url/avatar.jpg',
    };

    it('should throw BadRequestException if google is not configured', async () => {
      (service as any).googleClient = null;

      await expect(service.loginWithGoogle('credential')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should register and return tokens for a new Google user', async () => {
      const mockTicket = { getPayload: jest.fn().mockReturnValue(mockPayload) };
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue(mockTicket),
      };
      usersRepo.findOne.mockResolvedValue(null);
      const newUser = { ...mockUser, email: 'google@example.com' };
      usersRepo.create.mockReturnValue(newUser);
      usersRepo.save.mockResolvedValue(newUser);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      const result = await service.loginWithGoogle('google_credential');

      expect(result.accessToken).toBe('mock_token');
      expect(result.user.email).toBe('google@example.com');
    });

    it('should login an existing active Google user', async () => {
      const mockTicket = { getPayload: jest.fn().mockReturnValue(mockPayload) };
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue(mockTicket),
      };
      const existingUser = {
        ...mockUser,
        email: 'google@example.com',
        avatar_url: undefined,
      };
      usersRepo.findOne.mockResolvedValue(existingUser);
      usersRepo.update.mockResolvedValue({ affected: 1 } as any);
      logsRepo.create.mockReturnValue(mockLog);
      logsRepo.save.mockResolvedValue(mockLog);

      const result = await service.loginWithGoogle('google_credential');

      expect(result.accessToken).toBe('mock_token');
    });

    it('should throw ForbiddenException if existing Google user is inactive', async () => {
      const mockTicket = { getPayload: jest.fn().mockReturnValue(mockPayload) };
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue(mockTicket),
      };
      const inactiveUser = {
        ...mockUser,
        email: 'google@example.com',
        is_active: false,
        avatar_url: 'existing-avatar.jpg',
      };
      usersRepo.findOne.mockResolvedValue(inactiveUser);

      await expect(
        service.loginWithGoogle('google_credential'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if Google token verification fails', async () => {
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockRejectedValue(new Error('invalid token')),
      };

      await expect(service.loginWithGoogle('bad_credential')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if payload is missing', async () => {
      const mockTicket = { getPayload: jest.fn().mockReturnValue(null) };
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue(mockTicket),
      };

      await expect(service.loginWithGoogle('credential')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
