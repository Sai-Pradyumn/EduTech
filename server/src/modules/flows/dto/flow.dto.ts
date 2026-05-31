import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Difficulty } from '../../../common/enums';
import {
  FLOW_NODE_STATUSES,
  FLOW_NODE_TYPES,
  FLOW_STATUSES,
  FlowNodeStatus,
  FlowNodeType,
  FlowStatus,
} from '../schemas/flow.schema';

export class GenerateFlowDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  goal!: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetRole?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredStack?: string[];

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(600)
  dailyMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(52)
  timelineWeeks?: number;

  @IsOptional()
  @IsString()
  learningStyle?: string;
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsIn(FLOW_STATUSES as unknown as string[])
  status?: FlowStatus;
}

export class PositionDto {
  @IsNumber() x!: number;
  @IsNumber() y!: number;
}

export class AddNodeDto {
  @IsIn(FLOW_NODE_TYPES as unknown as string[])
  type!: FlowNodeType;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional() @IsString() @MaxLength(600) summary?: string;
  @IsOptional() @IsString() @MaxLength(400) objective?: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
  @IsOptional() @IsNumber() @Min(0) estimatedMinutes?: number;
  @IsOptional() @IsNumber() stage?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  position?: PositionDto;

  @IsOptional() @IsArray() @IsString({ each: true }) prerequisites?: string[];
}

export class UpdateNodeDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(600) summary?: string;
  @IsOptional() @IsString() @MaxLength(400) objective?: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
  @IsOptional() @IsNumber() @Min(0) estimatedMinutes?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) masteryScore?: number;

  @IsOptional()
  @IsIn(FLOW_NODE_STATUSES as unknown as string[])
  status?: FlowNodeStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  position?: PositionDto;

  @IsOptional() @IsArray() @IsString({ each: true }) prerequisites?: string[];
  @IsOptional() @IsString() linkedQuizId?: string;
  @IsOptional() @IsString() linkedProjectId?: string;
}
