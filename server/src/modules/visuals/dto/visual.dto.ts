import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  VISUAL_SOURCE_TYPES,
  VISUAL_TYPES,
  VisualSourceType,
  VisualType,
} from '../schemas/visual-asset.schema';

export class GenerateVisualDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  concept!: string;

  @IsOptional() @IsString() @MaxLength(600) prompt?: string;

  @IsOptional()
  @IsIn(VISUAL_TYPES)
  type?: VisualType;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  level?: 'beginner' | 'intermediate' | 'advanced';

  @IsOptional()
  @IsIn(VISUAL_SOURCE_TYPES)
  sourceType?: VisualSourceType;

  @IsOptional() @IsString() sourceId?: string;
}

export class UpdateVisualDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(600) caption?: string;
}

export class FromFlowNodeDto {
  @IsString() flowId!: string;
  @IsString() nodeId!: string;

  @IsOptional()
  @IsIn(VISUAL_TYPES)
  type?: VisualType;
}
