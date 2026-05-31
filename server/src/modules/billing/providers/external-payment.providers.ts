import { PlanId } from '../plans';
import {
  CheckoutSession,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

type CheckoutInput = { userId: string; planId: PlanId; amountInr: number };

/**
 * Stripe placeholder (Phase 10 · M1). Wired but inert until STRIPE_SECRET_KEY is set and
 * ENABLE_PAYMENT_PROVIDER is on. Implement createCheckout with the Stripe SDK here; the
 * controller/service already speak the PaymentProvider shape.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly isLive = false;

  constructor(private readonly secretKey?: string) {}

  createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    void input;
    return Promise.reject(new Error('StripePaymentProvider not configured'));
  }

  cancel(): Promise<{ status: 'cancelled' }> {
    return Promise.reject(new Error('StripePaymentProvider not configured'));
  }

  verifyWebhook(): Promise<WebhookResult> {
    return Promise.resolve({ verified: false });
  }
}

/** Razorpay placeholder for India — same contract, inert until configured. */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';
  readonly isLive = false;

  constructor(
    private readonly keyId?: string,
    private readonly keySecret?: string,
  ) {}

  createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    void input;
    return Promise.reject(new Error('RazorpayPaymentProvider not configured'));
  }

  cancel(): Promise<{ status: 'cancelled' }> {
    return Promise.reject(new Error('RazorpayPaymentProvider not configured'));
  }

  verifyWebhook(): Promise<WebhookResult> {
    return Promise.resolve({ verified: false });
  }
}
