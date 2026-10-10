import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidateIf,
  type ValidationOptions,
} from 'class-validator';
import type { GameStatus } from '../../generated/prisma/client';
import { trim, trimToNull } from '../../common/validation/transforms';
import {
  GAME_DATE_PATTERN,
  GAME_TIME_PATTERN,
  isCalendarDate,
} from '../game-schedule';

/** Same limits as the Game CHECK constraints (migration 20260930220000_game_creation). */
export const GAME_TITLE_MIN_LENGTH = 3;
export const GAME_TITLE_MAX_LENGTH = 80;
export const GAME_DESCRIPTION_MAX_LENGTH = 500;
export const GAME_LOCATION_MIN_LENGTH = 2;
export const GAME_LOCATION_MAX_LENGTH = 120;
export const GAME_MAX_PLAYERS = 100;
export const GAME_LIST_MAX_LIMIT = 50;
export const GAME_LIST_DEFAULT_LIMIT = 20;

export const GAME_STATUSES = [
  'OPEN',
  'FULL',
  'ACTIVE',
  'CANCELLED',
  'COMPLETED',
] as const satisfies readonly GameStatus[];

const whenPresent = () => ValidateIf((_, value) => value !== undefined);

function IsGameDate(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isGameDate',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isCalendarDate(value);
        },
      },
    });
  };
}

const SportRules = () =>
  applyDecorators(IsUUID('all', { message: 'Choose a sport.' }));

const TitleRules = () =>
  applyDecorators(
    Transform(trim),
    IsString({ message: 'Title must be text.' }),
    MinLength(GAME_TITLE_MIN_LENGTH, {
      message: `Title must be at least ${GAME_TITLE_MIN_LENGTH} characters.`,
    }),
    MaxLength(GAME_TITLE_MAX_LENGTH, {
      message: `Title must be at most ${GAME_TITLE_MAX_LENGTH} characters.`,
    }),
  );

const DescriptionRules = () =>
  applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    IsString({ message: 'Description must be text.' }),
    MaxLength(GAME_DESCRIPTION_MAX_LENGTH, {
      message: `Description must be at most ${GAME_DESCRIPTION_MAX_LENGTH} characters.`,
    }),
  );

const RequiredPlayersRules = () =>
  applyDecorators(
    IsDefined({ message: 'Required players is required.' }),
    IsInt({ message: 'Required players must be a whole number.' }),
    Min(1, { message: 'Required players must be at least 1.' }),
    Max(GAME_MAX_PLAYERS, {
      message: `Required players cannot be more than ${GAME_MAX_PLAYERS}.`,
    }),
  );

const DateRules = () =>
  applyDecorators(
    Transform(trim),
    Matches(GAME_DATE_PATTERN, { message: 'Date must look like 2026-10-04.' }),
    IsGameDate({ message: 'Choose a real calendar date.' }),
  );

const TimeRules = (label: string) =>
  applyDecorators(
    Transform(trim),
    Matches(GAME_TIME_PATTERN, {
      message: `${label} must be a time like 18:30.`,
    }),
  );

const LocationRules = () =>
  applyDecorators(
    Transform(trim),
    IsString({ message: 'Location must be text.' }),
    IsNotEmpty({ message: 'Add a location.' }),
    MinLength(GAME_LOCATION_MIN_LENGTH, {
      message: `Location must be at least ${GAME_LOCATION_MIN_LENGTH} characters.`,
    }),
    MaxLength(GAME_LOCATION_MAX_LENGTH, {
      message: `Location must be at most ${GAME_LOCATION_MAX_LENGTH} characters.`,
    }),
  );

const OptionalCoordinate = (label: string, limit: number) =>
  applyDecorators(
    IsOptional(),
    IsNumber(
      { allowNaN: false, allowInfinity: false },
      { message: `${label} must be a number.` },
    ),
    Min(-limit, {
      message: `${label} must be between -${limit} and ${limit}.`,
    }),
    Max(limit, { message: `${label} must be between -${limit} and ${limit}.` }),
  );

const OptionalClub = () =>
  applyDecorators(
    IsOptional(),
    IsUUID('all', { message: 'Club must be a club id.' }),
  );

/**
 * Everything the host fills in. The host (from the JWT), status (always OPEN), player
 * count, and timestamps are never accepted: the global ValidationPipe rejects unknown fields.
 */
export class CreateGameDto {
  @SportRules()
  sportId!: string;

  @OptionalClub()
  clubId?: string | null;

  @TitleRules()
  title!: string;

  @DescriptionRules()
  description?: string | null;

  @RequiredPlayersRules()
  requiredPlayers!: number;

  @DateRules()
  gameDate!: string;

  @TimeRules('Start time')
  startTime!: string;

  @TimeRules('End time')
  endTime!: string;

  @LocationRules()
  locationName!: string;

  @OptionalCoordinate('Latitude', 90)
  latitude?: number | null;

  @OptionalCoordinate('Longitude', 180)
  longitude?: number | null;
}

/**
 * Host edits. Omitted fields stay as they are; null clears description, club, or
 * coordinates. Status only changes through cancel (and later the game lifecycle).
 */
export class UpdateGameDto {
  @whenPresent()
  @SportRules()
  sportId?: string;

  @OptionalClub()
  clubId?: string | null;

  @whenPresent()
  @TitleRules()
  title?: string;

  @DescriptionRules()
  description?: string | null;

  @whenPresent()
  @RequiredPlayersRules()
  requiredPlayers?: number;

  @whenPresent()
  @DateRules()
  gameDate?: string;

  @whenPresent()
  @TimeRules('Start time')
  startTime?: string;

  @whenPresent()
  @TimeRules('End time')
  endTime?: string;

  @whenPresent()
  @LocationRules()
  locationName?: string;

  @OptionalCoordinate('Latitude', 90)
  latitude?: number | null;

  @OptionalCoordinate('Longitude', 180)
  longitude?: number | null;
}

export class ListGamesQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'sportId must be a sport id.' })
  sportId?: string;

  @IsOptional()
  @IsIn(GAME_STATUSES, {
    message: `status must be one of ${GAME_STATUSES.join(', ')}.`,
  })
  status?: GameStatus;

  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== 'today' && value !== 'upcoming')
  @IsGameDate({
    message: 'gameDate must be today, upcoming, or a date like 2026-10-04.',
  })
  /** "today", "upcoming" (today and later, the default), or one YYYY-MM-DD date. */
  gameDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(GAME_LIST_MAX_LIMIT, {
    message: `limit cannot be more than ${GAME_LIST_MAX_LIMIT}.`,
  })
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset must be a whole number.' })
  @Min(0, { message: 'offset cannot be negative.' })
  offset?: number;
}
