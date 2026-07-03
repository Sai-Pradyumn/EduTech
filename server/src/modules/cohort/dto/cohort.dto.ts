import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { CohortStatus } from '../../../common/enums';

export class CreateCohortDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsString() @MaxLength(120) roadmapGoal?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(CohortStatus) status?: CohortStatus;
}

export class UpdateCohortDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsString() @MaxLength(120) roadmapGoal?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(CohortStatus) status?: CohortStatus;
}

export class AddCohortMembersDto {
  @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) userIds!: string[];
  @IsIn(['mentor', 'student']) role!: 'mentor' | 'student';
}

export class AnnouncementDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) body?: string;
}

export class LeaderboardOptInDto {
  @IsBoolean() optIn!: boolean;
}
