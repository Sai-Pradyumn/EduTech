import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  Branch,
  CareerTarget,
  EducationLevel,
  LearningStyle,
  SkillLevel,
  TargetTimeline,
  TimePerDay,
} from '../../../common/enums';

export class CreateStudentProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName!: string;

  @IsEnum(EducationLevel)
  educationLevel!: EducationLevel;

  @IsEnum(Branch)
  branch!: Branch;

  @IsEnum(SkillLevel)
  currentSkillLevel!: SkillLevel;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  currentSkills!: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  weakAreas!: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(280)
  mainGoal!: string;

  @IsEnum(TimePerDay)
  availableTimePerDay!: TimePerDay;

  @IsEnum(TargetTimeline)
  targetTimeline!: TargetTimeline;

  @IsEnum(LearningStyle)
  preferredLearningStyle!: LearningStyle;

  @IsString()
  @MaxLength(40)
  preferredLanguage!: string;

  @IsEnum(CareerTarget)
  careerTarget!: CareerTarget;
}
