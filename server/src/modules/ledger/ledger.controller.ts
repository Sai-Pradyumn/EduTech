import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { LedgerService } from './ledger.service';
import { LedgerEntryDocument } from './schemas/ledger-entry.schema';

function toView(e: LedgerEntryDocument) {
  return {
    id: String(e._id),
    kind: e.kind,
    title: e.title,
    detail: e.detail,
    score: e.score ?? null,
    evidenceRef: e.evidenceRef ?? null,
    at: e.at.toISOString(),
  };
}

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.ledger.list(user.id)).map(toView);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.ledger.stats(user.id);
  }
}
