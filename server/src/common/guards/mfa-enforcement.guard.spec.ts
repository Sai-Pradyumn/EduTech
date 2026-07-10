import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { UsersService } from '../../modules/users/users.service';
import { MfaEnforcementGuard } from './mfa-enforcement.guard';

function makeContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function makeGuard(opts: {
  required: boolean;
  flagOn: boolean;
  mfaEnabled?: boolean;
}) {
  const reflector = {
    getAllAndOverride: () => opts.required,
  } as unknown as Reflector;
  const config = {
    get: () => opts.flagOn,
  } as unknown as ConfigService<AppConfig, true>;
  const users = {
    findById: jest
      .fn()
      .mockResolvedValue(
        opts.mfaEnabled === undefined ? null : { mfaEnabled: opts.mfaEnabled },
      ),
  } as unknown as UsersService;
  return {
    guard: new MfaEnforcementGuard(reflector, config, users),
    users,
  };
}

describe('MfaEnforcementGuard', () => {
  it('allows routes without @RequireMfa and never hits the DB', async () => {
    const { guard, users } = makeGuard({ required: false, flagOn: true });
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).resolves.toBe(
      true,
    );
    expect(users.findById as jest.Mock).not.toHaveBeenCalled();
  });

  it('no-ops when the REQUIRE_ADMIN_MFA flag is off', async () => {
    const { guard, users } = makeGuard({ required: true, flagOn: false });
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).resolves.toBe(
      true,
    );
    expect(users.findById as jest.Mock).not.toHaveBeenCalled();
  });

  it('allows an admin who has MFA enrolled', async () => {
    const { guard } = makeGuard({
      required: true,
      flagOn: true,
      mfaEnabled: true,
    });
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).resolves.toBe(
      true,
    );
  });

  it('blocks an admin without MFA when enforcement is on', async () => {
    const { guard } = makeGuard({
      required: true,
      flagOn: true,
      mfaEnabled: false,
    });
    await expect(
      guard.canActivate(makeContext({ id: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not block unauthenticated/public requests (auth guard owns that)', async () => {
    const { guard } = makeGuard({ required: true, flagOn: true });
    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
  });
});
