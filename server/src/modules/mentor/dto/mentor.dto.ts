import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class ReviewProjectDto {
  @IsEnum(['approved', 'changes_requested'])
  decision!: 'approved' | 'changes_requested';

  @IsString()
  @MaxLength(2000)
  feedback!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  score?: number;
}

export class UpdateMentorProfileDto {
  @IsOptional() @IsString() @MaxLength(120) headline?: string;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(60) experienceYears?: number;
  @IsOptional() @IsString() @MaxLength(200) availability?: string;
}
