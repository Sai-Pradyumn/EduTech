import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PASSPORT_VISIBILITY,
  PassportVisibility,
} from '../schemas/skill-passport.schema';
import {
  EVIDENCE_SOURCE_TYPES,
  EvidenceSourceType,
} from '../schemas/skill-evidence.schema';

class PublicSettingsDto {
  @IsOptional() @IsBoolean() showScores?: boolean;
  @IsOptional() @IsBoolean() showProjects?: boolean;
  @IsOptional() @IsBoolean() showTimeline?: boolean;
  @IsOptional() @IsBoolean() showCertificates?: boolean;
  @IsOptional() @IsBoolean() verifiedOnly?: boolean;
}

export class UpdatePassportDto {
  @IsOptional() @IsString() @MaxLength(160) headline?: string;
  @IsOptional() @IsString() @MaxLength(80) targetRole?: string;
  @IsOptional()
  @IsIn(PASSPORT_VISIBILITY)
  visibility?: PassportVisibility;
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicSettingsDto)
  publicSettings?: PublicSettingsDto;
}

export class AddEvidenceDto {
  @IsString() @MinLength(1) @MaxLength(80) skill!: string;
  @IsIn(EVIDENCE_SOURCE_TYPES)
  sourceType!: EvidenceSourceType;
  @IsString() @MinLength(2) @MaxLength(280) summary!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) score?: number;
  @IsOptional() @IsUrl() url?: string;
}
