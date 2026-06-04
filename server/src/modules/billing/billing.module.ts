import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AiUsageLog,
  AiUsageLogSchema,
} from '../ai/schemas/ai-usage-log.schema';
import {
  Subscription,
  SubscriptionSchema,
} from './schemas/subscription.schema';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './schemas/payment-transaction.schema';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider';
import { StripePaymentProvider } from './providers/external-payment.providers';
import {
  PAYMENT_PROVIDER_TOKEN,
  PaymentProvider,
} from './providers/payment-provider.interface';

/**
 * Billing + AI metering (Phase 4 · B5/B6 → Phase 10 · M1). Plan catalog, checkout via the
 * PaymentProvider abstraction (mock by default; Stripe/Razorpay slot in behind the same
 * shape), subscriptions, transactions, and a usage meter aggregated from ai_usage_logs.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: AiUsageLog.name, schema: AiUsageLogSchema },
    ]),
  ],
  controllers: [BillingController],
  providers: [
    BillingService,
    MockPaymentProvider,
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, MockPaymentProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
      ): PaymentProvider => {
        // Live providers activate only when ENABLE_PAYMENT_PROVIDER + keys are present.
        const enabled =
          config.get<string>('ENABLE_PAYMENT_PROVIDER') === 'true';
        if (!enabled) return mock;
        const choice = config.get<string>('PAYMENT_PROVIDER') ?? 'razorpay';
        const rzpId = config.get<string>('RAZORPAY_KEY_ID');
        const rzpSecret = config.get<string>('RAZORPAY_KEY_SECRET');
        const rzpWebhook = config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
        if (choice === 'razorpay' && rzpId && rzpSecret)
          return new RazorpayPaymentProvider(rzpId, rzpSecret, rzpWebhook);
        const stripeKey = config.get<string>('STRIPE_SECRET_KEY');
        if (choice === 'stripe' && stripeKey)
          return new StripePaymentProvider(
            stripeKey,
            config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '',
            config.get<string>('clientOrigin') ?? '',
          );
        return mock;
      },
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
