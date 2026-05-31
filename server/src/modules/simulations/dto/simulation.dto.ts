import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Difficulty } from '../../../common/enums';
import { SIMULATION_TYPES, SimulationType } from '../schemas/simulation.schema';

export class StartSimulationDto {
  @IsIn(SIMULATION_TYPES) type!: SimulationType;
  @IsString() @MinLength(2) @MaxLength(160) topic!: string;
  @IsOptional() @IsEnum(Difficulty) difficulty?: Difficulty;
}

export class RespondDto {
  @IsString() @MinLength(1) @MaxLength(3000) message!: string;
}

export class RetryDto {
  @IsOptional() @IsBoolean() harder?: boolean;
}
