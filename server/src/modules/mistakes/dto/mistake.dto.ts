import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MISTAKE_SOURCES,
  MISTAKE_STATUSES,
  MistakeSource,
  MistakeStatus,
} from '../schemas/mistake.schema';

export class CaptureMistakeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  concept!: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100) severity?: number;

  @IsOptional()
  @IsIn(MISTAKE_SOURCES)
  source?: MistakeSource;

  @IsOptional() @IsString() sourceId?: string;
}

export class UpdateMistakeStatusDto {
  @IsIn(MISTAKE_STATUSES)
  status!: MistakeStatus;
}

export class ToggleActionDto {
  @IsString() actionId!: string;
  @IsBoolean() done!: boolean;
}
