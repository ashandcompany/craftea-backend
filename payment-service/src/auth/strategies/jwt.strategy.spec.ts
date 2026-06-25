import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (_key: string, defaultValue?: string) =>
                defaultValue ?? 'test-secret',
            ),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return user object from JWT payload', () => {
    const payload = { id: 42, role: 'admin' };

    const result = strategy.validate(payload);

    expect(result).toEqual({ id: 42, role: 'admin' });
  });

  it('should return user role as-is', () => {
    const payload = { id: 7, role: 'artist' };

    const result = strategy.validate(payload);

    expect(result.role).toBe('artist');
  });
});
