import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TargetTimeline, TimePerDay } from '../../../common/enums';

/** Generate a roadmap from the student's profile, with optional overrides. */
export class GenerateRoadmapDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  goal?: string;

  @IsOptional()
  @IsEnum(TargetTimeline)
  targetTimeline?: TargetTimeline;

  @IsOptional()
  @IsEnum(TimePerDay)
  availableTimePerDay?: TimePerDay;
}
