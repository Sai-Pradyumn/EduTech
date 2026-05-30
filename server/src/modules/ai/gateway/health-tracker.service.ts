import { Injectable, Logger } from '@nestjs/common';

interface ProviderHealth {
  cooldownUntil: number;
  consecutiveFailures: number;
}

const RATE_LIMIT_COOLDOWN_MS = 30_000; // 429 → back off ~30s
const AUTH_FAIL_COOLDOWN_MS = 5 * 60_000; // 401/403 → back off 5m (likely bad key)
const GENERIC_FAIL_COOLDOWN_MS = 10_000;

/**
 * Per-provider circuit breaker. Mirrors the reference repo's healthTracker: a provider
 * that rate-limits or auth-fails is skipped for a cooldown window; success resets it.
 */
@Injectable()
export class HealthTrackerService {
  private readonly logger = new Logger('LlmHealth');
  private readonly state = new Map<string, ProviderHealth>();

  isAvailable(provider: string): boolean {
    const h = this.state.get(provider);
    return !h || Date.now() >= h.cooldownUntil;
  }

  recordSuccess(provider: string): void {
    this.state.set(provider, { cooldownUntil: 0, consecutiveFailures: 0 });
  }

  recordFailure(provider: string, status?: number): void {
    const cooldown =
      status === 429
        ? RATE_LIMIT_COOLDOWN_MS
        : status === 401 || status === 403
          ? AUTH_FAIL_COOLDOWN_MS
          : GENERIC_FAIL_COOLDOWN_MS;
    const prev = this.state.get(provider);
    this.state.set(provider, {
      cooldownUntil: Date.now() + cooldown,
      consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
    });
    this.logger.warn(
      `Provider "${provider}" cooling down ${cooldown}ms (status ${status ?? 'n/a'}).`,
    );
  }

  snapshot(): { provider: string; availableInMs: number }[] {
    const now = Date.now();
    return [...this.state.entries()].map(([provider, h]) => ({
      provider,
      availableInMs: Math.max(0, h.cooldownUntil - now),
    }));
  }
}
