import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { DailyPlanService } from './daily-plan.service';
import { DailyPlanDocument } from './schemas/daily-plan.schema';
import {
  CompleteItemDto,
  GeneratePlanDto,
  ReorderItemsDto,
  SetItemNoteDto,
  SetReflectionDto,
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
    mood: p.mood ?? null,
    reflection: p.reflection ?? '',
  };
}

@Controller('daily-plan')
export class DailyPlanController {
  constructor(private readonly plan: DailyPlanService) {}

  // `x-timezone` (the browser's IANA zone, added by the client interceptor) anchors
  // the "today"/streak/day-boundary logic to the learner's wall clock, not UTC.
  @Get('today')
  async today(
    @CurrentUser() user: AuthUser,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(await this.plan.getToday(user.id, tz));
  }

  @Post('generate')
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() dto: GeneratePlanDto,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(await this.plan.generate(user.id, dto.mode, tz));
  }

  @Post('complete-item')
  async complete(
    @CurrentUser() user: AuthUser,
    @Body() dto: CompleteItemDto,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(await this.plan.completeItem(user.id, dto.itemId, tz));
  }

  @Post('item-note')
  async setNote(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetItemNoteDto,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(
      await this.plan.setItemNote(user.id, dto.itemId, dto.note, tz),
    );
  }

  @Post('reflection')
  async reflection(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetReflectionDto,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(
      await this.plan.setReflection(user.id, dto.mood, dto.reflection, tz),
    );
  }

  @Post('carry-over')
  async carryOver(
    @CurrentUser() user: AuthUser,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(await this.plan.carryOver(user.id, tz));
  }

  @Post('reorder')
  async reorder(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderItemsDto,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(await this.plan.reorder(user.id, dto.itemIds, tz));
  }

  @Post('recalculate')
  async recalculate(
    @CurrentUser() user: AuthUser,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(await this.plan.recalculate(user.id, tz));
  }

  @Post('quick-mode')
  async quick(
    @CurrentUser() user: AuthUser,
    @Headers('x-timezone') tz?: string,
  ) {
    return toView(await this.plan.quickMode(user.id, tz));
  }

  @Get('streak')
  async streak(
    @CurrentUser() user: AuthUser,
    @Headers('x-timezone') tz?: string,
  ) {
    return this.plan.streak(user.id, tz);
  }

  @Get('history')
  async history(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
    @Headers('x-timezone') tz?: string,
  ) {
    const n = Number(days);
    return this.plan.history(user.id, Number.isFinite(n) && n > 0 ? n : 7, tz);
  }
}
