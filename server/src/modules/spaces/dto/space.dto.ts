import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SPACE_SOURCE_TYPES, SpaceSourceType } from '../schemas/study-space.schema';

export class CreateSpaceDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
}

export class UpdateSpaceDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
}

export class AddSourceDto {
  @IsIn(SPACE_SOURCE_TYPES as unknown as string[]) type!: SpaceSourceType;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(20000) text?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() ref?: string;
}

export class AskSpaceDto {
  @IsString() @MinLength(2) @MaxLength(500) question!: string;
}
