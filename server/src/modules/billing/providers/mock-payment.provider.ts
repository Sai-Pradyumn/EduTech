import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlanId } from '../plans';
import {
  CheckoutSession,
  PaymentProvider,
  WebhookResult,
} from './payment-provider.interface';

/** Default offline payment provider — instant "paid" with a synthetic reference. */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly isLive = false;

  createCheckout(input: {
    userId: string;
    planId: PlanId;
    amountInr: number;
  }): Promise<CheckoutSession> {
    return Promise.resolve({
      provider: this.name,
      reference: `mock_${randomUUID().slice(0, 12)}`,
      status: 'paid',
      checkoutUrl: '',
      amountInr: input.amountInr,
      currency: 'INR',
    });
  }

  cancel(): Promise<{ status: 'cancelled' }> {
    return Promise.resolve({ status: 'cancelled' });
  }

  verifyPayment(): boolean {
    return true;
  }

  verifyWebhook(): WebhookResult {
    return { verified: true, event: 'mock.noop', paid: true };
  }
}
