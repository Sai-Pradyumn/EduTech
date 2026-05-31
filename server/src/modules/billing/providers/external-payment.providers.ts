import { PlanId } from '../plans';
import {
  CheckoutSession,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

type CheckoutInput = { userId: string; planId: PlanId; amountInr: number };

/**
 * Stripe placeholder (Phase 10). Wired but inert until STRIPE_SECRET_KEY is set,
 * ENABLE_PAYMENT_PROVIDER=true and PAYMENT_PROVIDER=stripe. Razorpay is the recommended
 * (and fully implemented) provider for INR — see razorpay-payment.provider.ts. Implement
 * createCheckout with the Stripe SDK here; the service already speaks the PaymentProvider shape.
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

  verifyWebhook(): WebhookResult {
    return { verified: false };
  }
}
