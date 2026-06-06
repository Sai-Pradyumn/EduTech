import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { DailyPlanService } from './daily-plan.service';
import { DailyPlanDocument } from './schemas/daily-plan.schema';
import {
  CompleteItemDto,
  GeneratePlanDto,
  ReorderItemsDto,
  SetItemNoteDto,
} from './dto/daily-plan.dto';

function toView(p: DailyPlanDocument) {
  return {
    id: String(p._id),
    date: p.date,
    mode: p.mode,
    totalMinutes: p.totalMinutes,
    items: p.items.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      reason: i.reason,
      route: i.route,
      estimateMinutes: i.estimateMinutes,
      done: i.done,
      sourceId: i.sourceId ?? null,
      note: i.note ?? '',
    })),
    completed: p.items.filter((i) => i.done).length,
  };
}

@Controller('daily-plan')
export class DailyPlanController {
  constructor(private readonly plan: DailyPlanService) {}

  @Get('today')
  async today(@CurrentUser() user: AuthUser) {
    return toView(await this.plan.getToday(user.id));
  }

  @Post('generate')
  async generate(@CurrentUser() user: AuthUser, @Body() dto: GeneratePlanDto) {
    return toView(await this.plan.generate(user.id, dto.mode));
  }

  @Post('complete-item')
  async complete(@CurrentUser() user: AuthUser, @Body() dto: CompleteItemDto) {
    return toView(await this.plan.completeItem(user.id, dto.itemId));
  }

  @Post('item-note')
  async setNote(@CurrentUser() user: AuthUser, @Body() dto: SetItemNoteDto) {
    return toView(await this.plan.setItemNote(user.id, dto.itemId, dto.note));
  }

  @Post('carry-over')
  async carryOver(@CurrentUser() user: AuthUser) {
    return toView(await this.plan.carryOver(user.id));
  }

  @Post('reorder')
  async reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderItemsDto) {
    return toView(await this.plan.reorder(user.id, dto.itemIds));
  }

  @Post('recalculate')
  async recalculate(@CurrentUser() user: AuthUser) {
    return toView(await this.plan.recalculate(user.id));
  }

  @Post('quick-mode')
  async quick(@CurrentUser() user: AuthUser) {
    return toView(await this.plan.quickMode(user.id));
  }

  @Get('streak')
  async streak(@CurrentUser() user: AuthUser) {
    return this.plan.streak(user.id);
  }

  @Get('history')
  async history(@CurrentUser() user: AuthUser, @Query('days') days?: string) {
    const n = Number(days);
    return this.plan.history(user.id, Number.isFinite(n) && n > 0 ? n : 7);
  }
}
