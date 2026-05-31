import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Subscription,
  SubscriptionSchema,
} from '../billing/schemas/subscription.schema';
import {
  Membership,
  MembershipSchema,
} from '../tenancy/schemas/membership.schema';
import {
  EntitlementUsage,
  EntitlementUsageSchema,
} from './schemas/entitlement-usage.schema';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';

/**
 * Entitlements (Phase 10 · M1). Global so any feature module (AI, flows, visuals, voice,
 * simulations…) can inject EntitlementsService to meter/gate a capability. Reads the
 * Subscription model directly — it deliberately does NOT import BillingModule, so AiModule
 * can depend on it without a circular dependency.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: EntitlementUsage.name, schema: EntitlementUsageSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
