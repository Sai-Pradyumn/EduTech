import { createHmac, randomUUID } from 'crypto';
import Razorpay from 'razorpay';
import { PlanId } from '../plans';
import {
  CheckoutSession,
  PaymentProvider,
  VerifyInput,
  WebhookResult,
} from './payment-provider.interface';

/**
 * Razorpay payment provider (Phase 10). Recommended for INR pricing (flat ~2%, no fixed
 * per-transaction fee). createCheckout makes a Razorpay Order; the client opens the Razorpay
 * Checkout widget with the returned orderId + keyId, then the server verifies the returned
 * signature (and the webhook) with HMAC-SHA256 before activating the subscription.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';
  readonly isLive = true;
  private readonly client: Razorpay;

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret = '',
  ) {
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createCheckout(input: {
    userId: string;
    planId: PlanId;
    amountInr: number;
  }): Promise<CheckoutSession> {
    const amountPaise = Math.max(100, Math.round(input.amountInr * 100));
    const order = await this.client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `asta_${input.planId}_${randomUUID().slice(0, 8)}`,
      notes: { userId: input.userId, planId: input.planId },
    });
    return {
      provider: this.name,
      reference: order.id,
      orderId: order.id,
      keyId: this.keyId,
      status: 'pending',
      checkoutUrl: '',
      amountInr: input.amountInr,
      currency: 'INR',
    };
  }

  cancel(): Promise<{ status: 'cancelled' }> {
    // Razorpay subscriptions are not used (one-time orders); nothing to cancel server-side.
    return Promise.resolve({ status: 'cancelled' });
  }

  /** Verify the checkout signature: HMAC_SHA256(order_id|payment_id, key_secret). */
  verifyPayment(input: VerifyInput): boolean {
    const expected = createHmac('sha256', this.keySecret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');
    return timingSafeEqual(expected, input.signature);
  }

  /** Verify a webhook body against X-Razorpay-Signature using the webhook secret. */
  verifyWebhook(rawBody: string, signature?: string): WebhookResult {
    if (!this.webhookSecret || !signature) return { verified: false };
    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    if (!timingSafeEqual(expected, signature)) return { verified: false };
    let event: string | undefined;
    let reference: string | undefined;
    let paid = false;
    try {
      const parsed = JSON.parse(rawBody) as {
        event?: string;
        payload?: { payment?: { entity?: { order_id?: string } } };
      };
      event = parsed.event;
      reference = parsed.payload?.payment?.entity?.order_id;
      paid = event === 'payment.captured' || event === 'order.paid';
    } catch {
      // ignore malformed bodies — verified signature but unparseable
    }
    return { verified: true, event, reference, paid };
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
