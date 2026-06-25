import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function createMockContext(
  user: { role: string },
  handler = jest.fn(),
  cls = jest.fn(),
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new RolesGuard(reflector);
  });

  it('should return true when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = createMockContext({ role: 'user' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    );
  });

  it('should return true when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = createMockContext({ role: 'admin' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = createMockContext({ role: 'user' });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should return true when user role matches one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'artist']);
    const ctx = createMockContext({ role: 'artist' });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when user role matches none of required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'artist']);
    const ctx = createMockContext({ role: 'user' });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
