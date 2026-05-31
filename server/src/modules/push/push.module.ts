import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PushSubscription,
  PushSubscriptionSchema,
} from './schemas/push-subscription.schema';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/** Web Push (Phase 10 · M4/M5). Global so the notifications layer can call PushService.notify. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PushSubscription.name, schema: PushSubscriptionSchema },
    ]),
  ],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
