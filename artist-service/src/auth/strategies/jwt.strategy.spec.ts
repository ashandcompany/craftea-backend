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
    expect(strategy.validate({ id: 42, role: 'user' })).toEqual({
      id: 42,
      role: 'user',
    });
  });

  it('should validate admin payload', () => {
    expect(strategy.validate({ id: 1, role: 'admin' })).toEqual({
      id: 1,
      role: 'admin',
    });
  });
});
