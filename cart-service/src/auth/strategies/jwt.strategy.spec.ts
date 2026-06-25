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
            get: jest.fn((_key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should validate and return user payload', () => {
    const payload = { id: 42, role: 'user' };
    expect(strategy.validate(payload)).toEqual({ id: 42, role: 'user' });
  });

  it('should validate admin payload', () => {
    const payload = { id: 1, role: 'admin' };
    expect(strategy.validate(payload)).toEqual({ id: 1, role: 'admin' });
  });
});
