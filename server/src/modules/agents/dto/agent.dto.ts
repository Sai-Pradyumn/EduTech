import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AgentType } from '../../../common/enums';

export class AgentMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;

  /** RAG scope — restrict retrieval to these documents. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  documentIds?: string[];
}

export class PinSessionDto {
  @IsBoolean()
  pinned!: boolean;
}

export class FeedbackDto {
  @IsOptional()
  @IsString()
  messageId?: string;

  @IsIn(['up', 'down', 'too_hard', 'too_easy', 'incorrect'])
  rating!: 'up' | 'down' | 'too_hard' | 'too_easy' | 'incorrect';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
