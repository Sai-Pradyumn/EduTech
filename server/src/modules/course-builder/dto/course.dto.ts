import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Difficulty } from '../../../common/enums';
import {
  COURSE_VISIBILITIES,
  CourseVisibility,
} from '../schemas/course.schema';

export class GenerateCourseDto {
  @IsString() @MinLength(2) @MaxLength(160) goal!: string;
  @IsOptional() @IsEnum(Difficulty) level?: Difficulty;
  @IsOptional() @IsString() @MaxLength(120) audience?: string;
  @IsOptional() @IsString() @MaxLength(4000) outline?: string;
}

class LessonDto {
  @IsString() id!: string;
  @IsString() @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(5000) content?: string;
}
class ModuleDto {
  @IsString() id!: string;
  @IsString() @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(600) summary?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonDto)
  lessons?: LessonDto[];
}

export class UpdateCourseDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsString() @MaxLength(120) audience?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleDto)
  modules?: ModuleDto[];
}

export class PublishCourseDto {
  @IsIn(COURSE_VISIBILITIES)
  visibility!: CourseVisibility;
}

export class LessonProgressDto {
  @IsBoolean() completed!: boolean;
}
