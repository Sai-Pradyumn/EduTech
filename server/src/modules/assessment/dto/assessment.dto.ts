import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Difficulty } from '../../../common/enums';

export class GenerateQuizDto {
  @IsEnum(['topic', 'document', 'weak_area', 'roadmap'])
  source!: 'topic' | 'document' | 'weak_area' | 'roadmap';

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  topic?: string;

  @IsOptional()
  @IsMongoId()
  documentId?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  count?: number;
}

export class AnswerDto {
  @IsInt()
  @Min(0)
  questionIndex!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  answerIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;
}

export class SubmitAttemptDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;
}
