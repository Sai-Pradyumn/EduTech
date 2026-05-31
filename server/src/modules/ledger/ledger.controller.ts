import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { LedgerService } from './ledger.service';
import { LedgerEntryDocument } from './schemas/ledger-entry.schema';
import { RecordLedgerEventDto, SetLedgerVisibilityDto } from './dto/ledger.dto';

export function toLedgerView(e: LedgerEntryDocument) {
  return {
    id: String(e._id),
    kind: e.kind,
    title: e.title,
    detail: e.detail,
    score: e.score ?? null,
    evidenceRef: e.evidenceRef ?? null,
    skills: e.skills ?? [],
    verificationLevel: e.verificationLevel,
    visibleOnPassport: e.visibleOnPassport,
    at: e.at.toISOString(),
  };
}

@Controller('proof-ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return (await this.ledger.list(user.id)).map(toLedgerView);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.ledger.summary(user.id);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.ledger.stats(user.id);
  }

  /** Manually record a verified event (self-reported evidence). */
  @Post('events')
  async record(@CurrentUser() user: AuthUser, @Body() dto: RecordLedgerEventDto) {
    await this.ledger.record(user.id, {
      kind: dto.kind,
      title: dto.title,
      detail: dto.detail,
      score: dto.score,
      skills: dto.skills,
      verificationLevel: 'self',
    });
    return { ok: true };
  }

  /** Show / hide a single event from the public Skill Passport. */
  @Patch('events/:id/visibility')
  setVisibility(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetLedgerVisibilityDto) {
    return this.ledger.setVisibility(user.id, id, dto.visible);
  }
}
