import { PlanId } from '../plans';

export interface CheckoutSession {
  provider: string;
  reference: string;
  /** 'paid' (mock — instant) or 'pending' (live — awaits client widget + verification). */
  status: 'paid' | 'pending' | 'failed';
  /** For redirect-style providers; mock/razorpay return '' (no redirect). */
  checkoutUrl?: string;
  amountInr: number;
  currency: string;
  /** Live-provider order handles for the client checkout widget. */
  orderId?: string;
  keyId?: string;
}

export interface WebhookResult {
  verified: boolean;
  event?: string;
  /** Order/subscription reference the webhook concerns (when verified). */
  reference?: string;
  /** True when the event represents a successful, captured payment. */
  paid?: boolean;
}

export interface VerifyInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

/**
 * Payment provider abstraction (Phase 10 · M1). Mock is the real, default flow for local
 * dev — no keys required. Razorpay (recommended for INR — flat ~2%, no fixed fee) and
 * Stripe implementations slot in behind the same shape; activated by ENABLE_PAYMENT_PROVIDER
 * + PAYMENT_PROVIDER + keys.
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
  /** Verify a client-completed payment (order/payment/signature). Default true for mock. */
  verifyPayment?(input: VerifyInput): boolean;
  /** Verify a raw webhook payload + signature. */
  verifyWebhook?(rawBody: string, signature?: string): WebhookResult;
}

export const PAYMENT_PROVIDER_TOKEN = Symbol('PAYMENT_PROVIDER');
