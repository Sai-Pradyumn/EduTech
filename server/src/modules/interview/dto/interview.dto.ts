import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INTERVIEW_TYPES, InterviewType } from '../interview-bank';

export class StartInterviewDto {
  @IsIn(INTERVIEW_TYPES) type!: InterviewType;
  @IsOptional() @IsString() roleId?: string;
}

export class RespondInterviewDto {
  @IsString() @MinLength(1) @MaxLength(4000) answer!: string;
}
