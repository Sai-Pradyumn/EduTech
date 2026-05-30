import { IsDateString, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { LiveSessionStatus } from '../../../common/enums';

export class CreateLiveSessionDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsMongoId() cohortId?: string;
  @IsDateString() scheduledStart!: string;
  @IsOptional() @IsInt() @Min(10) @Max(480) durationMins?: number;
}

export class UpdateLiveSessionDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsDateString() scheduledStart?: string;
  @IsOptional() @IsInt() @Min(10) @Max(480) durationMins?: number;
  @IsOptional() @IsEnum(LiveSessionStatus) status?: LiveSessionStatus;
}

export class EndSessionDto {
  @IsOptional() @IsString() @MaxLength(6000) notes?: string;
}
