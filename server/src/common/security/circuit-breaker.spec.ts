import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitOpenError,
} from './circuit-breaker';

describe('security/circuit-breaker', () => {
  function makeBreaker(startMs = 0) {
    let clock = startMs;
    const breaker = new CircuitBreaker('slack', {
      failureThreshold: 3,
      cooldownMs: 10_000,
      now: () => clock,
    });
    return { breaker, tick: (ms: number) => (clock += ms) };
  }

  const boom = () => Promise.reject(new Error('provider down'));
  const ok = () => Promise.resolve('sent');

  it('stays closed below the failure threshold and passes results through', async () => {
    const { breaker } = makeBreaker();
    await expect(breaker.execute(boom)).rejects.toThrow('provider down');
    await expect(breaker.execute(boom)).rejects.toThrow('provider down');
    expect(breaker.state).toBe('closed');
    await expect(breaker.execute(ok)).resolves.toBe('sent');
  });

  it('opens after consecutive failures and fails fast without calling the fn', async () => {
    const { breaker } = makeBreaker();
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(boom)).rejects.toThrow('provider down');
    }
    expect(breaker.state).toBe('open');

    const fn = jest.fn(ok);
    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('success resets the consecutive-failure count', async () => {
    const { breaker } = makeBreaker();
    await expect(breaker.execute(boom)).rejects.toThrow();
    await expect(breaker.execute(boom)).rejects.toThrow();
    await expect(breaker.execute(ok)).resolves.toBe('sent');
    await expect(breaker.execute(boom)).rejects.toThrow('provider down');
    expect(breaker.state).toBe('closed'); // count restarted after the success
  });

  it('half-opens after the cooldown; a successful probe closes it', async () => {
    const { breaker, tick } = makeBreaker();
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(boom)).rejects.toThrow();
    }
    tick(10_001);
    expect(breaker.state).toBe('half-open');
    await expect(breaker.execute(ok)).resolves.toBe('sent');
    expect(breaker.state).toBe('closed');
  });

  it('a failed probe re-opens the circuit for another cooldown', async () => {
    const { breaker, tick } = makeBreaker();
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(boom)).rejects.toThrow();
    }
    tick(10_001);
    await expect(breaker.execute(boom)).rejects.toThrow('provider down');
    expect(breaker.state).toBe('open');
  });

  it('registry keeps circuits independent per key', async () => {
    const registry = new CircuitBreakerRegistry({
      failureThreshold: 1,
      cooldownMs: 10_000,
    });
    await expect(registry.for('slack').execute(boom)).rejects.toThrow();
    expect(registry.for('slack').state).toBe('open');
    expect(registry.for('discord').state).toBe('closed');
    await expect(registry.for('discord').execute(ok)).resolves.toBe('sent');
  });
});
