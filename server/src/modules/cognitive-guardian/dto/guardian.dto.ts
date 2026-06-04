import { IsString, MaxLength, MinLength } from 'class-validator';

export class GuardianReviewDto {
  @IsString() @MinLength(1) @MaxLength(4000) question!: string;
  @IsString() @MinLength(1) @MaxLength(8000) answer!: string;
}
