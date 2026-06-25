import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => {
              if (key === 'JWT_SECRET') return 'test_secret';
              return def;
            }),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('should return id and role from the JWT payload', () => {
      const payload: JwtPayload = { id: 1, role: 'buyer' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ id: 1, role: 'buyer' });
    });

    it('should return admin role from the JWT payload', () => {
      const payload: JwtPayload = { id: 99, role: 'admin' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ id: 99, role: 'admin' });
    });
  });
});
