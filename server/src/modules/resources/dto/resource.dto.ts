import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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

export class SuggestResourceDto {
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsUrl({ require_protocol: true }) @MaxLength(500) url!: string;
  @IsString() @MinLength(2) @MaxLength(60) provider!: string;
  @IsIn(RESOURCE_KINDS as readonly string[]) kind!: ResourceKind;
  @IsIn(RESOURCE_LEVELS as readonly string[]) level!: ResourceLevel;
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  topics!: string[];
  @IsOptional() @IsInt() @Min(0) @Max(6000) minutes?: number;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
  @IsOptional() @IsBoolean() free?: boolean;
}
