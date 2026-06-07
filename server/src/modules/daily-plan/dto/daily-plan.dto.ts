import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
} from 'class-validator';
import { DAILY_PLAN_MODES, DailyPlanMode } from '../schemas/daily-plan.schema';

export class GeneratePlanDto {
  @IsIn(DAILY_PLAN_MODES) mode!: DailyPlanMode;
}

export class CompleteItemDto {
  @IsString() itemId!: string;
}

export class SetItemNoteDto {
  @IsString() itemId!: string;
  @IsString() @MaxLength(500) note!: string;
}

export class ReorderItemsDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) itemIds!: string[];
}
