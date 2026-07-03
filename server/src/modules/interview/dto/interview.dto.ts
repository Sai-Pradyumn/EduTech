import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INTERVIEW_TYPES, InterviewType } from '../interview-bank';
import { ARCHETYPE_IDS, CompanyArchetype } from '../interview.agent';

export class StartInterviewDto {
  @IsIn(INTERVIEW_TYPES) type!: InterviewType;
  @IsOptional() @IsString() roleId?: string;
  /** Company style to tune the question ladder for (optional). */
  @IsOptional() @IsIn(ARCHETYPE_IDS) archetype?: CompanyArchetype;
}

export class RespondInterviewDto {
  @IsString() @MinLength(1) @MaxLength(4000) answer!: string;
}
