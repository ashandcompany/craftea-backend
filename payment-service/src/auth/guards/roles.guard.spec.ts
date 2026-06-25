import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

const makeContext = (userRole: string, handlerRoles: string[] | undefined) => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(handlerRoles) } as any;
  const guard = new RolesGuard(reflector);
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user: { role: userRole } }),
    }),
  } as unknown as ExecutionContext;
  return { guard, context, reflector };
};

describe('RolesGuard', () => {
  it('should return true when no roles are required', () => {
    const { guard, context } = makeContext('user', undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when user has the required role', () => {
    const { guard, context } = makeContext('admin', ['admin']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should return true when user has one of multiple required roles', () => {
    const { guard, context } = makeContext('artist', ['admin', 'artist']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user does not have the required role', () => {
    const { guard, context } = makeContext('user', ['admin']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should read roles using ROLES_KEY from reflector', () => {
    const { guard, context, reflector } = makeContext('admin', ['admin']);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
  });
});
