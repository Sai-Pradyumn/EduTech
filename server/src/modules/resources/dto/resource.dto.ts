import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  PROGRESS_STATUSES,
  ProgressStatus,
  RESOURCE_KINDS,
  RESOURCE_LEVELS,
  ResourceKind,
  ResourceLevel,
} from '../schemas/resource.schema';

export class ListResourcesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  topic?: string;

  @IsOptional()
  @IsIn(RESOURCE_KINDS as readonly string[])
  kind?: ResourceKind;

  @IsOptional()
  @IsIn(RESOURCE_LEVELS as readonly string[])
  level?: ResourceLevel;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class SetProgressDto {
  @IsIn(PROGRESS_STATUSES as readonly string[])
  status!: ProgressStatus;
}
