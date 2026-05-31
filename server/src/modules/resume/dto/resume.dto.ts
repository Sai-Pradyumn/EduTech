import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { APPLICATION_STATUS } from '../schemas/application.schema';

export class UpdateResumeDto {
  @IsOptional() @IsString() @MaxLength(120) headline?: string;
  @IsOptional() @IsString() @MaxLength(1200) summary?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) highlights?: string[];
}

export class AnalyzeJdDto {
  @IsString() @MinLength(1) @MaxLength(120) company!: string;
  @IsString() @MinLength(1) @MaxLength(120) role!: string;
  @IsString() @MinLength(20) @MaxLength(8000) jdText!: string;
}

export class CreateApplicationDto extends AnalyzeJdDto {}

export class UpdateApplicationDto {
  @IsOptional() @IsIn(APPLICATION_STATUS as unknown as string[]) status?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
