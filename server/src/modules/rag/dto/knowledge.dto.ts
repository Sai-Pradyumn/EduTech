import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UploadTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200_000)
  content!: string;
}

export class UploadFileMetaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

/** Edit a document's user-facing metadata (title / tags). */
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}

export class AskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question!: string;

  /** Restrict retrieval to these documents; omit to ask the whole corpus. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  documentIds?: string[];
}

/** Persist one grounded Q&A turn to the server-side history. */
export class SaveQaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question!: string;

  @IsString()
  @MaxLength(20_000)
  answer!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  sources?: Record<string, unknown>[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}
