import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
