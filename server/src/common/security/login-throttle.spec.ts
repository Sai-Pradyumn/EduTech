import { DEFAULT_THROTTLE, lockState, registerFailure } from './login-throttle';

describe('security/login-throttle', () => {
  const now = 1_700_000_000_000;

  describe('registerFailure', () => {
    it('does not lock before the threshold', () => {
      for (let prev = 0; prev < DEFAULT_THROTTLE.maxAttempts - 1; prev++) {
        expect(registerFailure(prev, now).lockedUntilMs).toBeNull();
      }
    });

    it('locks once the threshold is reached', () => {
      const r = registerFailure(DEFAULT_THROTTLE.maxAttempts - 1, now);
      expect(r.attempts).toBe(DEFAULT_THROTTLE.maxAttempts);
      expect(r.lockedUntilMs).toBe(now + DEFAULT_THROTTLE.baseLockMs);
    });

    it('backs off exponentially on further failures', () => {
      const first = registerFailure(DEFAULT_THROTTLE.maxAttempts - 1, now);
      const second = registerFailure(DEFAULT_THROTTLE.maxAttempts, now);
      const third = registerFailure(DEFAULT_THROTTLE.maxAttempts + 1, now);
      expect(second.lockedUntilMs! - now).toBe(DEFAULT_THROTTLE.baseLockMs * 2);
      expect(third.lockedUntilMs! - now).toBe(DEFAULT_THROTTLE.baseLockMs * 4);
      expect(first.lockedUntilMs).toBeLessThan(second.lockedUntilMs!);
    });

    it('caps the lock duration at maxLockMs', () => {
      const r = registerFailure(50, now);
      expect(r.lockedUntilMs! - now).toBe(DEFAULT_THROTTLE.maxLockMs);
    });
  });

  describe('lockState', () => {
    it('reports locked while the expiry is in the future', () => {
      const d = lockState(now + 30_000, now);
      expect(d.locked).toBe(true);
      expect(d.retryAfterSec).toBe(30);
    });

    it('reports unlocked once the expiry passes', () => {
      expect(lockState(now - 1, now).locked).toBe(false);
      expect(lockState(null, now).locked).toBe(false);
      expect(lockState(undefined, now).locked).toBe(false);
    });
  });
});
