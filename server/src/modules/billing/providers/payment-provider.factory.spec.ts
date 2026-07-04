import { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from './mock-payment.provider';
import { createPaymentProvider } from './payment-provider.factory';

/**
 * Provider selection is the "just add keys" contract: the operator flips one flag and
 * pastes credentials to go live, and a half-configured env must degrade to mock rather
 * than crash checkout. These tests pin that decision table.
 */
function cfg(env: Record<string, string>): ConfigService {
  return { get: (k: string) => env[k] } as unknown as ConfigService;
}

const mock = new MockPaymentProvider();

describe('createPaymentProvider', () => {
  it('returns the mock provider when payments are not enabled', () => {
    expect(createPaymentProvider(cfg({}), mock).name).toBe('mock');
    expect(
      createPaymentProvider(cfg({ ENABLE_PAYMENT_PROVIDER: 'false' }), mock)
        .name,
    ).toBe('mock');
  });

  it('selects Razorpay when enabled with both keys present', () => {
    const p = createPaymentProvider(
      cfg({
        ENABLE_PAYMENT_PROVIDER: 'true',
        PAYMENT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test_123',
        RAZORPAY_KEY_SECRET: 'secret_123',
      }),
      mock,
    );
    expect(p.name).toBe('razorpay');
    expect(p.isLive).toBe(true);
  });

  it('defaults to Razorpay when PAYMENT_PROVIDER is unset', () => {
    const p = createPaymentProvider(
      cfg({
        ENABLE_PAYMENT_PROVIDER: 'true',
        RAZORPAY_KEY_ID: 'rzp_test_123',
        RAZORPAY_KEY_SECRET: 'secret_123',
      }),
      mock,
    );
    expect(p.name).toBe('razorpay');
  });

  it('degrades to mock when Razorpay is chosen but a key is missing', () => {
    const p = createPaymentProvider(
      cfg({
        ENABLE_PAYMENT_PROVIDER: 'true',
        PAYMENT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: 'rzp_test_123',
        // no RAZORPAY_KEY_SECRET
      }),
      mock,
    );
    expect(p.name).toBe('mock');
  });

  it('selects Stripe when enabled with a secret key', () => {
    const p = createPaymentProvider(
      cfg({
        ENABLE_PAYMENT_PROVIDER: 'true',
        PAYMENT_PROVIDER: 'stripe',
        STRIPE_SECRET_KEY: 'sk_test_123',
      }),
      mock,
    );
    expect(p.name).toBe('stripe');
    expect(p.isLive).toBe(true);
  });

  it('degrades to mock when Stripe is chosen but the secret key is missing', () => {
    const p = createPaymentProvider(
      cfg({ ENABLE_PAYMENT_PROVIDER: 'true', PAYMENT_PROVIDER: 'stripe' }),
      mock,
    );
    expect(p.name).toBe('mock');
  });
});
