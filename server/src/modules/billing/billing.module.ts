import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiUsageLog, AiUsageLogSchema } from '../ai/schemas/ai-usage-log.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { PaymentTransaction, PaymentTransactionSchema } from './schemas/payment-transaction.schema';
import { BillingController } from './billing.controller';
import { BillingService } from './services/billing.service';

/**
 * Billing + AI metering (Phase 4 · B5/B6): plan catalog, mock checkout, subscriptions,
 * payment transactions, and a usage meter aggregated from ai_usage_logs against plan limits.
 * Real flow; Razorpay/Stripe slot behind the same checkout shape later.
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
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
