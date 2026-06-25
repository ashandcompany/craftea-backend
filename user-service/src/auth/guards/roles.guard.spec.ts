import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

const createMockContext = (
  role: string,
  handler: any = {},
  klass: any = {},
): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  }) as any;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: jest.fn() },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  it('should return true when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(null);

    const result = guard.canActivate(createMockContext('buyer'));

    expect(result).toBe(true);
  });

  it('should return true when user has the required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    const result = guard.canActivate(createMockContext('admin'));

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user does not have required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(() => guard.canActivate(createMockContext('buyer'))).toThrow(
      ForbiddenException,
    );
  });

  it('should accept any of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'artist']);

    const result = guard.canActivate(createMockContext('artist'));

    expect(result).toBe(true);
  });

  it(`should use ROLES_KEY metadata key`, () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const handler = {};
    const klass = {};
    const ctx = createMockContext('buyer', handler, klass);

    guard.canActivate(ctx);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      klass,
    ]);
  });
});
