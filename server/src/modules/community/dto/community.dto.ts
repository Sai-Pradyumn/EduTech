import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateChannelDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsEnum(['discussion', 'help', 'showcase']) kind?:
    | 'discussion'
    | 'help'
    | 'showcase';
}

export class CreateThreadDto {
  @IsMongoId() channelId!: string;
  @IsString() @MinLength(3) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(8000) body?: string;
  @IsOptional() @IsEnum(['discussion', 'question', 'showcase']) kind?:
    | 'discussion'
    | 'question'
    | 'showcase';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  tags?: string[];
  @IsOptional() @IsMongoId() projectId?: string;
}

export class CreateReplyDto {
  @IsString() @MinLength(1) @MaxLength(8000) body!: string;
}

export class ReportContentDto {
  @IsMongoId() threadId!: string;
  /** Present when the report targets a reply inside the thread. */
  @IsOptional() @IsMongoId() replyId?: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
