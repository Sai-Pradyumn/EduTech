import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../practice.types';

const MAX_CODE = 50_000;

export class StdioTestDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(8_000) stdin!: string;
  @IsString() @MaxLength(8_000) expectedStdout!: string;
}

export class CodeFileDto {
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(MAX_CODE) content!: string;
}

export class RunCodeDto {
  @IsIn(SUPPORTED_LANGUAGES) language!: SupportedLanguage;

  @IsString() @MaxLength(MAX_CODE) code!: string;

  @IsOptional() @IsString() @MaxLength(8_000) stdin?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CodeFileDto)
  files?: CodeFileDto[];
}

export class SubmitCodeDto {
  @IsIn(SUPPORTED_LANGUAGES) language!: SupportedLanguage;

  @IsString() @MaxLength(MAX_CODE) code!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => StdioTestDto)
  tests!: StdioTestDto[];
}

/** Records a graded outcome so it feeds the Proof Ledger / Mistake OS. */
export class RecordOutcomeDto {
  @IsIn(SUPPORTED_LANGUAGES) language!: SupportedLanguage;
  @IsBoolean() passed!: boolean;
  @IsOptional() @IsString() @MaxLength(160) problemTitle?: string;
  @IsOptional() @IsString() @MaxLength(120) skill?: string;
}

/** Persists a Free Play snippet (language + files + stdin) for later. */
export class SaveSnippetDto {
  @IsString() @MaxLength(160) title!: string;

  @IsIn(SUPPORTED_LANGUAGES) language!: SupportedLanguage;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CodeFileDto)
  files!: CodeFileDto[];

  @IsOptional() @IsString() @MaxLength(8_000) stdin?: string;
}
