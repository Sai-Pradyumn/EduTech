import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RegenerateWeekDto {
  @IsInt()
  @Min(1)
  @Max(104)
  weekNumber!: number;

  /** Optional learner instruction, e.g. "go deeper on testing" or "less theory". */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
