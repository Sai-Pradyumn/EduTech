import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Update progress: mark a week complete and/or toggle a task.
 * Task ids are `w{weekNumber}:t{taskIndex}`.
 */
export class UpdateRoadmapProgressDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weekNumber?: number;

  @IsOptional()
  @IsBoolean()
  weekCompleted?: boolean;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsBoolean()
  taskCompleted?: boolean;
}
