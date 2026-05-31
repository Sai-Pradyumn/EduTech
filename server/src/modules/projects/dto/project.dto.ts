import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Difficulty, ItemStatus } from '../../../common/enums';

export class GenerateProjectDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  goal!: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}

export class AddTaskDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phase?: string;
}

export class MoveTaskDto {
  @IsEnum(ItemStatus)
  status!: ItemStatus;
}

export class SubmitProjectDto {
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @IsOptional()
  @IsUrl()
  demoUrl?: string;

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ToggleImprovementDto {
  @IsBoolean()
  done!: boolean;
}
