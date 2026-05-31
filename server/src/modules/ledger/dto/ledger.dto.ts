import {
  ArrayMaxSize,
  IsArray,
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
import { LEDGER_KINDS, LedgerKind } from '../schemas/ledger-entry.schema';

export class RecordLedgerEventDto {
  @IsIn(LEDGER_KINDS)
  kind!: LedgerKind;

  @IsString() @MinLength(2) @MaxLength(160) title!: string;

  @IsOptional() @IsString() @MaxLength(400) detail?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) score?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  skills?: string[];
}

export class SetLedgerVisibilityDto {
  @IsBoolean() visible!: boolean;
}
