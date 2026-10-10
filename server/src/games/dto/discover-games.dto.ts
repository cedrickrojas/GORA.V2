import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import type { GameStatus } from '../../generated/prisma/client';
import { trim } from '../../common/validation/transforms';
import { GAME_DATE_PATTERN, isCalendarDate } from '../game-schedule';

/** Statuses discovery can show. CANCELLED games are never discoverable. */
export const DISCOVERABLE_STATUSES = [
  'OPEN',
  'FULL',
  'ACTIVE',
  'COMPLETED',
] as const satisfies readonly GameStatus[];

/** Shown when no status is asked for; COMPLETED only on request. */
export const DEFAULT_DISCOVERY_STATUSES = [
  'OPEN',
  'FULL',
  'ACTIVE',
] as const satisfies readonly GameStatus[];

/** Date shortcuts decided on the server's game clock (GAME_TIMEZONE). */
export const DISCOVERY_DATE_PRESETS = [
  'today',
  'tomorrow',
  'this-week',
] as const;

export type DiscoveryDatePreset = (typeof DISCOVERY_DATE_PRESETS)[number];

export const DISCOVERY_MIN_DISTANCE_KM = 0.1;
export const DISCOVERY_MAX_DISTANCE_KM = 100;
export const DISCOVERY_DEFAULT_LIMIT = 50;
export const DISCOVERY_MAX_LIMIT = 100;

/**
 * Query strings arrive as text. Only a real decimal becomes a number; anything else
 * (including an empty value) stays as it is so validation rejects it instead of
 * turning it into 0.
 */
function toQueryNumber({ obj, key }: TransformFnParams): unknown {
  const raw: unknown = (obj as Record<string, unknown>)[key];

  if (typeof raw !== 'string') {
    return raw;
  }

  const text = raw.trim();
  return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text) ? Number(text) : raw;
}

export function isDiscoveryDatePreset(
  value: unknown,
): value is DiscoveryDatePreset {
  return DISCOVERY_DATE_PRESETS.some((preset) => preset === value);
}

function IsDiscoveryDate(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isDiscoveryDate',
      target: target.constructor,
      propertyName: String(propertyName),
      options,
      validator: {
        validate(value: unknown): boolean {
          return (
            isDiscoveryDatePreset(value) ||
            (typeof value === 'string' &&
              GAME_DATE_PATTERN.test(value) &&
              isCalendarDate(value))
          );
        },
      },
    });
  };
}

/**
 * GET /games/discover. Everything is optional: no filter lists every visible upcoming
 * OPEN/FULL/ACTIVE game, soonest first. latitude/longitude come together and only
 * center the search; they are never stored. distanceKm needs them (omit it for Any).
 */
export class DiscoverGamesQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'sportId must be a sport id.' })
  sportId?: string;

  @IsOptional()
  @Transform(trim)
  @IsDiscoveryDate({
    message: `date must be ${DISCOVERY_DATE_PRESETS.join(', ')}, or a date like 2026-10-04.`,
  })
  /** "today", "tomorrow", "this-week" (today + the next 6 days), or one YYYY-MM-DD date. */
  date?: string;

  @IsOptional()
  @Transform(toQueryNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'latitude must be a number.' },
  )
  @Min(-90, { message: 'latitude must be between -90 and 90.' })
  @Max(90, { message: 'latitude must be between -90 and 90.' })
  latitude?: number;

  @IsOptional()
  @Transform(toQueryNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'longitude must be a number.' },
  )
  @Min(-180, { message: 'longitude must be between -180 and 180.' })
  @Max(180, { message: 'longitude must be between -180 and 180.' })
  longitude?: number;

  @IsOptional()
  @Transform(toQueryNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'distanceKm must be a number.' },
  )
  @Min(DISCOVERY_MIN_DISTANCE_KM, {
    message: `distanceKm must be at least ${DISCOVERY_MIN_DISTANCE_KM}.`,
  })
  @Max(DISCOVERY_MAX_DISTANCE_KM, {
    message: `distanceKm cannot be more than ${DISCOVERY_MAX_DISTANCE_KM}. Leave it out for any distance.`,
  })
  distanceKm?: number;

  @IsOptional()
  @IsIn(DISCOVERABLE_STATUSES, {
    message: `status must be one of ${DISCOVERABLE_STATUSES.join(', ')}.`,
  })
  status?: GameStatus;

  @IsOptional()
  @Transform(toQueryNumber)
  @IsInt({ message: 'limit must be a whole number.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(DISCOVERY_MAX_LIMIT, {
    message: `limit cannot be more than ${DISCOVERY_MAX_LIMIT}.`,
  })
  limit?: number;
}
