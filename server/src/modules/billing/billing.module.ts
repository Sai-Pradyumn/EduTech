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
import { createPaymentProvider } from './providers/payment-provider.factory';
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
      // Live providers activate only when ENABLE_PAYMENT_PROVIDER=true + the chosen
      // provider's keys are present; anything missing degrades to mock (see the factory).
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, MockPaymentProvider],
      useFactory: (
        config: ConfigService,
        mock: MockPaymentProvider,
      ): PaymentProvider => createPaymentProvider(config, mock),
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
