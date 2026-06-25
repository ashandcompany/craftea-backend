import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const configService = {
      get: jest.fn((key: string, defaultValue: string) => defaultValue),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService);
  });

  describe('validate', () => {
    it('should return user object from payload', () => {
      const payload: JwtPayload = { id: 42, role: 'admin' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ id: 42, role: 'admin' });
    });

    it('should return user with role user', () => {
      const payload: JwtPayload = { id: 1, role: 'user' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ id: 1, role: 'user' });
    });

    it('should return user with role artist', () => {
      const payload: JwtPayload = { id: 7, role: 'artist' };

      const result = strategy.validate(payload);

      expect(result).toEqual({ id: 7, role: 'artist' });
    });
  });
});
