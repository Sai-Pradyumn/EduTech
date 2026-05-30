import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class IssueCertificateDto {
  @IsString() @MinLength(1) userId!: string;
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(120) skill?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) score?: number;
  @IsOptional() @IsString() projectId?: string;
}
