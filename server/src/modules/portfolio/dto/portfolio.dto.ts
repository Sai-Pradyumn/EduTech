import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class PortfolioLinkDto {
  @IsString() @MaxLength(40) label!: string;
  @IsUrl() url!: string;
}
class PortfolioPublicSettingsDto {
  @IsOptional() @IsBoolean() showProjects?: boolean;
  @IsOptional() @IsBoolean() showCertificates?: boolean;
  @IsOptional() @IsBoolean() showTimeline?: boolean;
  @IsOptional() @IsBoolean() showContact?: boolean;
}

export class UpdatePortfolioDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(2000) about?: string;
  @IsOptional() @IsString() @MaxLength(80) targetRole?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  skills?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PortfolioLinkDto)
  links?: PortfolioLinkDto[];
  @IsOptional() @IsString() @MaxLength(20) theme?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => PortfolioPublicSettingsDto)
  publicSettings?: PortfolioPublicSettingsDto;
}
