import { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaymentProvider } from './payment-provider.interface';
import { RazorpayPaymentProvider } from './razorpay-payment.provider';
import { StripePaymentProvider } from './external-payment.providers';

/**
 * Resolve the active payment provider from config (Phase 10 · M1).
 *
 * The mock provider is both the default and the safe fallback: a *live* provider is chosen
 * only when `ENABLE_PAYMENT_PROVIDER=true` AND the chosen provider's credentials are present.
 * A missing key degrades to mock rather than throwing, so a half-configured environment can
 * never take checkout down — the operator flips one flag and pastes keys to go live.
 *
 *   Razorpay (recommended for INR):
 *     ENABLE_PAYMENT_PROVIDER=true PAYMENT_PROVIDER=razorpay
 *     RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=...
 *   Stripe:
 *     ENABLE_PAYMENT_PROVIDER=true PAYMENT_PROVIDER=stripe
 *     STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
 */
export function createPaymentProvider(
  config: ConfigService,
  mock: MockPaymentProvider,
): PaymentProvider {
  const enabled = config.get<string>('ENABLE_PAYMENT_PROVIDER') === 'true';
  if (!enabled) return mock;

  const choice = (
    config.get<string>('PAYMENT_PROVIDER') ?? 'razorpay'
  ).toLowerCase();

  if (choice === 'stripe') {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) return mock;
    return new StripePaymentProvider(
      secretKey,
      config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '',
      config.get<string>('clientOrigin') ?? '',
    );
  }

  // Default: Razorpay.
  const keyId = config.get<string>('RAZORPAY_KEY_ID');
  const keySecret = config.get<string>('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) return mock;
  return new RazorpayPaymentProvider(
    keyId,
    keySecret,
    config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '',
  );
}
