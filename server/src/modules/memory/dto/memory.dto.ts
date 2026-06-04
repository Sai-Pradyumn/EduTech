import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { MEMORY_TYPES, MemoryType } from '../schemas/learner-memory.schema';

export const MEMORY_DECISIONS = ['save', 'dismiss'] as const;
export type MemoryDecision = (typeof MEMORY_DECISIONS)[number];

export class ConfirmMemoryDto {
  @IsIn(MEMORY_TYPES) type!: MemoryType;

  @IsString() @MinLength(1) @MaxLength(400) value!: string;

  @IsString() @MinLength(1) @MaxLength(400) summary!: string;

  @IsIn(MEMORY_DECISIONS) decision!: MemoryDecision;
}
