import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerEntry, LedgerEntrySchema } from './schemas/ledger-entry.schema';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';

/**
 * Phase 8 · Proof-of-Learning Ledger — append-only verified-event timeline. Decoupled: listens to
 * domain events and exposes record() for services that don't emit. Exported so Flows / Mistakes /
 * Simulations can log node-completion / mistake-resolution / simulation-finish.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
    ]),
  ],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
