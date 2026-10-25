import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { SkillLevel } from '../../generated/prisma/client';
import { trimToNull } from '../../common/validation/transforms';

export const SKILL_LEVELS = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'PROFESSIONAL',
] as const satisfies readonly SkillLevel[];

/** Same limit as the UserSport_position_check constraint. */
export const POSITION_MAX_LENGTH = 40;

const SKILL_LEVEL_MESSAGE = `Skill level must be one of ${SKILL_LEVELS.join(', ')}.`;
const POSITION_LENGTH_MESSAGE = `Position must be at most ${POSITION_MAX_LENGTH} characters.`;

/** No userId field: the owner always comes from the JWT, and unknown fields are rejected. */
export class AddUserSportDto {
  @IsUUID('all', { message: 'Choose a valid sport.' })
  sportId!: string;

  @IsIn(SKILL_LEVELS, { message: SKILL_LEVEL_MESSAGE })
  skillLevel!: SkillLevel;

  /** Optional for every sport; blank means no position. */
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'Position must be text.' })
  @MaxLength(POSITION_MAX_LENGTH, { message: POSITION_LENGTH_MESSAGE })
  position?: string | null;
}

/** The sport itself never changes; remove it and add another instead. */
export class UpdateUserSportDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(SKILL_LEVELS, { message: SKILL_LEVEL_MESSAGE })
  skillLevel?: SkillLevel;

  /** Omit to keep the position; null or blank removes it. */
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'Position must be text.' })
  @MaxLength(POSITION_MAX_LENGTH, { message: POSITION_LENGTH_MESSAGE })
  position?: string | null;
}
