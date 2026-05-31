import { ArrayMaxSize, IsArray, IsIn, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SESSION_STATUS, SESSION_TYPES, MentorSessionStatus, MentorSessionType } from '../schemas/mentor-session.schema';

export class UpsertMentorProfileDto {
  @IsString() @MinLength(2) @MaxLength(120) headline!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) expertise?: string[];
  @IsOptional() @IsString() @MaxLength(1200) bio?: string;
  @IsOptional() @IsString() @MaxLength(120) availability?: string;
  @IsOptional() @IsIn(['free', 'paid']) pricingMode?: 'free' | 'paid';
  @IsOptional() @IsString() @MaxLength(120) priceNote?: string;
  @IsOptional() @IsIn(['public', 'org']) visibility?: 'public' | 'org';
}

export class RequestSessionDto {
  @IsMongoId() mentorId!: string;
  @IsIn(SESSION_TYPES as unknown as string[]) type!: MentorSessionType;
  @IsOptional() @IsString() @MaxLength(800) message?: string;
  @IsOptional() @IsString() linkedProjectId?: string;
  @IsOptional() @IsString() linkedPortfolioUsername?: string;
}

export class UpdateSessionStatusDto {
  @IsIn(SESSION_STATUS as unknown as string[]) status!: MentorSessionStatus;
}

export class SessionNotesDto {
  @IsString() @MaxLength(2000) notes!: string;
}
