import { createHmac } from 'crypto';
import { MockPaymentProvider } from './mock-payment.provider';
import { RazorpayPaymentProvider } from './razorpay-payment.provider';
import { StripePaymentProvider } from './external-payment.providers';

/**
 * The payment providers guard real money, so the security-relevant paths — HMAC signature
 * verification for both the client return and the webhook — are pinned here. The live SDK
 * calls (order/session creation) are stubbed; only the mapping + verification logic is ours.
 */

describe('MockPaymentProvider', () => {
  const p = new MockPaymentProvider();

  it('is not a live provider', () => {
    expect(p.isLive).toBe(false);
  });

  it('checkout is instantly paid with a synthetic reference', async () => {
    const s = await p.createCheckout({
      userId: 'u1',
      planId: 'pro',
      amountInr: 499,
    });
    expect(s.status).toBe('paid');
    expect(s.reference).toMatch(/^mock_/);
    expect(s.amountInr).toBe(499);
  });

  it('verifyPayment always passes and the webhook reports paid', () => {
    expect(p.verifyPayment()).toBe(true);
    expect(p.verifyWebhook().paid).toBe(true);
  });
});

describe('RazorpayPaymentProvider', () => {
  const KEY_ID = 'rzp_test_key';
  const KEY_SECRET = 'rzp_test_secret';
  const WEBHOOK_SECRET = 'whsec_rzp';
  const provider = new RazorpayPaymentProvider(
    KEY_ID,
    KEY_SECRET,
    WEBHOOK_SECRET,
  );

  it('verifies a correct checkout signature and rejects a forged one', () => {
    const orderId = 'order_123';
    const paymentId = 'pay_456';
    const good = createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    expect(
      provider.verifyPayment({ orderId, paymentId, signature: good }),
    ).toBe(true);
    expect(
      provider.verifyPayment({ orderId, paymentId, signature: 'deadbeef' }),
    ).toBe(false);
  });

  it('accepts a well-signed webhook and flags captured payments as paid', () => {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { order_id: 'order_123' } } },
    });
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const r = provider.verifyWebhook(body, sig);
    expect(r.verified).toBe(true);
    expect(r.paid).toBe(true);
    expect(r.reference).toBe('order_123');
  });

  it('rejects a webhook with a bad signature or when no secret is configured', () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    expect(provider.verifyWebhook(body, 'nope').verified).toBe(false);
    const noSecret = new RazorpayPaymentProvider(KEY_ID, KEY_SECRET, '');
    expect(noSecret.verifyWebhook(body, 'anything').verified).toBe(false);
  });

  it('stays verified but not paid on a malformed (but correctly signed) body', () => {
    const body = 'not-json';
    const sig = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const r = provider.verifyWebhook(body, sig);
    expect(r.verified).toBe(true);
    expect(r.paid).toBe(false);
  });

  it('creates a Razorpay order and returns widget handles', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'order_abc' });
    (
      provider as unknown as { client: { orders: { create: jest.Mock } } }
    ).client = { orders: { create } };
    const s = await provider.createCheckout({
      userId: 'u1',
      planId: 'pro',
      amountInr: 499,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 49900, currency: 'INR' }),
    );
    expect(s.status).toBe('pending');
    expect(s.orderId).toBe('order_abc');
    expect(s.keyId).toBe(KEY_ID);
  });
});

describe('StripePaymentProvider', () => {
  function stub(
    provider: StripePaymentProvider,
    client: Record<string, unknown>,
  ): void {
    (provider as unknown as { client: Record<string, unknown> }).client =
      client;
  }

  it('marks a completed checkout session as paid', () => {
    const provider = new StripePaymentProvider(
      'sk_test_x',
      'whsec_stripe',
      'https://app.asta.dev',
    );
    stub(provider, {
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'checkout.session.completed',
          data: { object: { id: 'cs_123', payment_status: 'paid' } },
        }),
      },
    });
    expect(provider.verifyWebhook('{}', 'sig')).toEqual({
      verified: true,
      event: 'checkout.session.completed',
      reference: 'cs_123',
      paid: true,
    });
  });

  it('is verified but not paid for unrelated events', () => {
    const provider = new StripePaymentProvider('sk_test_x', 'whsec_stripe', '');
    stub(provider, {
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'payment_intent.created',
          data: { object: {} },
        }),
      },
    });
    const r = provider.verifyWebhook('{}', 'sig');
    expect(r.verified).toBe(true);
    expect(r.paid).toBe(false);
  });

  it('rejects a webhook whose signature fails construction or has no secret', () => {
    const provider = new StripePaymentProvider('sk_test_x', 'whsec_stripe', '');
    stub(provider, {
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('bad sig');
        }),
      },
    });
    expect(provider.verifyWebhook('{}', 'sig').verified).toBe(false);
    const noSecret = new StripePaymentProvider('sk_test_x', '', '');
    expect(noSecret.verifyWebhook('{}', 'sig').verified).toBe(false);
  });

  it('creates a redirect Checkout session and returns the hosted url', async () => {
    const provider = new StripePaymentProvider('sk_test_x', 'whsec_stripe', '');
    const create = jest
      .fn()
      .mockResolvedValue({ id: 'cs_abc', url: 'https://checkout.stripe/x' });
    stub(provider, { checkout: { sessions: { create } } });
    const s = await provider.createCheckout({
      userId: 'u1',
      planId: 'pro',
      amountInr: 499,
    });
    expect(create).toHaveBeenCalled();
    expect(s.status).toBe('pending');
    expect(s.checkoutUrl).toBe('https://checkout.stripe/x');
  });
});
