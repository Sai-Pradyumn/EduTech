import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  TEMPLATE_TYPES,
  TemplateType,
} from '../schemas/marketplace-template.schema';

export class CreateTemplateDto {
  @IsIn(TEMPLATE_TYPES) type!: TemplateType;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(800) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  tags?: string[];
  @IsOptional() @IsString() @MaxLength(40) level?: string;
  @IsOptional() @IsString() @MaxLength(80) targetRole?: string;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(800) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  tags?: string[];
  @IsOptional() @IsString() @MaxLength(40) level?: string;
  @IsOptional() @IsString() @MaxLength(80) targetRole?: string;
  @IsOptional() @IsObject() content?: Record<string, unknown>;
}

export class ReviewTemplateDto {
  @IsIn(['published', 'rejected']) decision!: 'published' | 'rejected';
  @IsOptional() @IsString() @MaxLength(400) note?: string;
}
