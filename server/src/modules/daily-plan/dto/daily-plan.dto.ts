import { IsIn, IsString } from 'class-validator';
import { DAILY_PLAN_MODES, DailyPlanMode } from '../schemas/daily-plan.schema';

export class GeneratePlanDto {
  @IsIn(DAILY_PLAN_MODES as unknown as string[]) mode!: DailyPlanMode;
}

export class CompleteItemDto {
  @IsString() itemId!: string;
}
