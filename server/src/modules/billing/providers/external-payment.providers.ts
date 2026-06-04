import Stripe from 'stripe';
import { PlanId } from '../plans';
import {
  CheckoutSession,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

type CheckoutInput = { userId: string; planId: PlanId; amountInr: number };

/**
 * Stripe payment provider (Phase 10). Activates when STRIPE_SECRET_KEY is set,
 * ENABLE_PAYMENT_PROVIDER=true and PAYMENT_PROVIDER=stripe (Razorpay remains the
 * recommended option for INR — see razorpay-payment.provider.ts).
 *
 * Model: Stripe Checkout is redirect-based. `createCheckout` creates a Checkout Session and
 * returns its hosted `url` as `checkoutUrl`; the client redirects there. Unlike Razorpay there
 * is no client-side signature to verify on return, so activation is driven by the
 * `checkout.session.completed` webhook (`verifyWebhook`), verified via the signing secret.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly isLive = true;
  private readonly client: InstanceType<typeof Stripe>;

  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret = '',
    private readonly clientOrigin = '',
  ) {
    this.client = new Stripe(secretKey);
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const amountPaise = Math.max(100, Math.round(input.amountInr * 100));
    const origin = this.clientOrigin || 'http://localhost:4200';
    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'inr',
            unit_amount: amountPaise,
            product_data: { name: `Asta ${input.planId} plan` },
          },
        },
      ],
      success_url: `${origin}/app/billing?checkout=success`,
      cancel_url: `${origin}/app/billing?checkout=cancelled`,
      metadata: { userId: input.userId, planId: input.planId },
    });
    return {
      provider: this.name,
      reference: session.id,
      status: 'pending',
      checkoutUrl: session.url ?? '',
      amountInr: input.amountInr,
      currency: 'INR',
    };
  }

  cancel(): Promise<{ status: 'cancelled' }> {
    // One-time Checkout payments — nothing to cancel server-side.
    return Promise.resolve({ status: 'cancelled' });
  }

  /** Verify + parse a Stripe webhook. `checkout.session.completed` marks the payment done. */
  verifyWebhook(rawBody: string, signature?: string): WebhookResult {
    if (!this.webhookSecret || !signature) return { verified: false };
    let event: { type: string; data: { object: unknown } };
    try {
      event = this.client.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch {
      return { verified: false };
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        id: string;
        payment_status?: string;
      };
      return {
        verified: true,
        event: event.type,
        reference: session.id,
        paid: session.payment_status === 'paid',
      };
    }
    return { verified: true, event: event.type, paid: false };
  }
}
