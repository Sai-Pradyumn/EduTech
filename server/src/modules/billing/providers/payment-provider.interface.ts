import { PlanId } from '../plans';

export interface CheckoutSession {
  provider: string;
  reference: string;
  status: 'paid' | 'pending' | 'failed';
  /** For real providers this is a redirect URL; mock returns '' (no redirect). */
  checkoutUrl?: string;
  amountInr: number;
  currency: string;
}

export interface WebhookResult {
  verified: boolean;
  event?: string;
  reference?: string;
}

/**
 * Payment provider abstraction (Phase 10 · M1). Mock is the real, default flow for local
 * dev — no keys required. Stripe/Razorpay implementations slot in behind the same shape
 * and are activated by the ENABLE_PAYMENT_PROVIDER flag + provider keys.
 */
export interface PaymentProvider {
  readonly name: string;
  readonly isLive: boolean;
  createCheckout(input: {
    userId: string;
    planId: PlanId;
    amountInr: number;
  }): Promise<CheckoutSession>;
  cancel(reference: string): Promise<{ status: 'cancelled' }>;
  verifyWebhook?(payload: unknown, signature?: string): Promise<WebhookResult>;
}

export const PAYMENT_PROVIDER_TOKEN = Symbol('PAYMENT_PROVIDER');
