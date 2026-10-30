import type { ClubSummary } from '@/types/club';
import type { ApiGame, CreateGameInput, GameStatus, UpdateGameInput } from '@/types/game';
import type { UserSummary } from '@/types/user';

/**
 * Create / Edit Game form rules. They mirror the server (CreateGameDto and the Game CHECK
 * constraints) so mistakes show before sending; the server stays the authority, including
 * what "today" is (its GAME_TIMEZONE). Dates and times are the venue's wall clock and are
 * never converted to another zone.
 */

export const GAME_TITLE_MIN = 3;
export const GAME_TITLE_MAX = 80;
export const GAME_DESCRIPTION_MAX = 500;
export const GAME_LOCATION_MIN = 2;
export const GAME_LOCATION_MAX = 120;
export const GAME_PLAYERS_MAX = 100;
export const GAME_MAX_DAYS_AHEAD = 365;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Games created in GORA have UUID ids; the demo feed's games do not. */
export function isServerGameId(gameId: string): boolean {
  return UUID_PATTERN.test(gameId);
}

export function gameHostSummary(game: ApiGame): UserSummary {
  return {
    id: game.host.id,
    username: game.host.username,
    displayName: game.host.displayName,
    avatarUrl: game.host.profileImageUrl,
  };
}

export function gameClubSummary(game: ApiGame): ClubSummary | null {
  return game.club ? { id: game.club.id, slug: game.club.slug, name: game.club.name, sport: game.sport.name } : null;
}

export interface GameForm {
  autoAccept: boolean;
  sportId: string;
  /** '' means no club. */
  clubId: string;
  title: string;
  description: string;
  /** An <input type="number"> gives a number, or '' when empty. */
  requiredPlayers: number | string;
  gameDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  latitude: number | string;
  longitude: number | string;
}

export type GameFormField = keyof GameForm;
export type GameFormErrors = Partial<Record<GameFormField, string>>;

export interface LocalMoment {
  date: string;
  time: string;
}

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  OPEN: 'Open',
  FULL: 'Full',
  ACTIVE: 'In progress',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

export function emptyGameForm(): GameForm {
  return {
    autoAccept: false,
    sportId: '',
    clubId: '',
    title: '',
    description: '',
    requiredPlayers: '',
    gameDate: '',
    startTime: '',
    endTime: '',
    locationName: '',
    latitude: '',
    longitude: '',
  };
}

export function gameToForm(game: ApiGame): GameForm {
  return {
    autoAccept: game.autoAccept ?? false,
    sportId: game.sport.id,
    clubId: game.club?.id ?? '',
    title: game.title,
    description: game.description ?? '',
    requiredPlayers: game.requiredPlayers,
    gameDate: game.gameDate,
    startTime: game.startTime,
    endTime: game.endTime ?? '',
    locationName: game.locationName,
    latitude: game.latitude ?? '',
    longitude: game.longitude ?? '',
  };
}

/** The device's local date and time, used only for the form's early checks. */
export function deviceMoment(now = new Date()): LocalMoment {
  const pad = (value: number) => String(value).padStart(2, '0');

  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function text(value: number | string): string {
  return String(value).trim();
}

function parseCoordinate(value: number | string): number | null {
  const raw = text(value);
  return raw === '' ? null : Number(raw);
}

/**
 * Field errors. When editing, an unchanged schedule is not re-checked against the clock,
 * so a game later today can still get a new title after its start time passed.
 */
export function validateGameForm(form: GameForm, now: LocalMoment, original?: ApiGame | null): GameFormErrors {
  const errors: GameFormErrors = {};
  const title = form.title.trim();
  const location = form.locationName.trim();
  const players = text(form.requiredPlayers);

  if (!form.sportId) {
    errors.sportId = 'Choose a sport.';
  }

  if (title.length < GAME_TITLE_MIN) {
    errors.title = `Title must be at least ${GAME_TITLE_MIN} characters.`;
  } else if (title.length > GAME_TITLE_MAX) {
    errors.title = `Title must be at most ${GAME_TITLE_MAX} characters.`;
  }

  if (form.description.trim().length > GAME_DESCRIPTION_MAX) {
    errors.description = `Description must be at most ${GAME_DESCRIPTION_MAX} characters.`;
  }

  if (players === '') {
    errors.requiredPlayers = 'How many players do you need?';
  } else if (!/^\d+$/.test(players) || Number(players) < 1) {
    errors.requiredPlayers = 'Required players must be a whole number of at least 1.';
  } else if (Number(players) > GAME_PLAYERS_MAX) {
    errors.requiredPlayers = `Required players cannot be more than ${GAME_PLAYERS_MAX}.`;
  }

  if (location.length === 0) {
    errors.locationName = 'Add a location.';
  } else if (location.length < GAME_LOCATION_MIN) {
    errors.locationName = `Location must be at least ${GAME_LOCATION_MIN} characters.`;
  } else if (location.length > GAME_LOCATION_MAX) {
    errors.locationName = `Location must be at most ${GAME_LOCATION_MAX} characters.`;
  }

  Object.assign(errors, scheduleErrors(form, now, original));
  Object.assign(errors, coordinateErrors(form));
  return errors;
}

function scheduleErrors(form: GameForm, now: LocalMoment, original?: ApiGame | null): GameFormErrors {
  const errors: GameFormErrors = {};

  if (!isCalendarDate(form.gameDate)) {
    errors.gameDate = 'Choose a date.';
  }

  if (!TIME_PATTERN.test(form.startTime)) {
    errors.startTime = 'Choose a start time.';
  }

  if (!TIME_PATTERN.test(form.endTime)) {
    errors.endTime = 'Choose an end time.';
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }

  if (minutesOfDay(form.endTime) <= minutesOfDay(form.startTime)) {
    errors.endTime = 'End time must be after the start time.';
  }

  const unchanged =
    original != null &&
    original.gameDate === form.gameDate &&
    original.startTime === form.startTime &&
    original.endTime === form.endTime;

  if (unchanged) {
    return errors;
  }

  if (form.gameDate < now.date) {
    errors.gameDate = 'Choose today or a future date.';
  } else if (form.gameDate > addDays(now.date, GAME_MAX_DAYS_AHEAD)) {
    errors.gameDate = `Games can be scheduled up to ${GAME_MAX_DAYS_AHEAD} days ahead.`;
  } else if (form.gameDate === now.date && minutesOfDay(form.startTime) <= minutesOfDay(now.time)) {
    errors.startTime = 'That start time has already passed. Choose a later time.';
  }

  return errors;
}

function coordinateErrors(form: GameForm): GameFormErrors {
  const errors: GameFormErrors = {};
  const latitude = parseCoordinate(form.latitude);
  const longitude = parseCoordinate(form.longitude);

  if (latitude !== null && !(Number.isFinite(latitude) && Math.abs(latitude) <= 90)) {
    errors.latitude = 'Latitude must be between -90 and 90.';
  }

  if (longitude !== null && !(Number.isFinite(longitude) && Math.abs(longitude) <= 180)) {
    errors.longitude = 'Longitude must be between -180 and 180.';
  }

  if (!errors.latitude && !errors.longitude && (latitude === null) !== (longitude === null)) {
    errors[latitude === null ? 'latitude' : 'longitude'] = 'Give both latitude and longitude, or neither.';
  }

  return errors;
}

export function toCreateGameInput(form: GameForm): CreateGameInput {
  const description = form.description.trim();

  return {
    autoAccept: form.autoAccept,
    sportId: form.sportId,
    clubId: form.clubId || null,
    title: form.title.trim(),
    description: description.length > 0 ? description : null,
    requiredPlayers: Number(text(form.requiredPlayers)),
    gameDate: form.gameDate,
    startTime: form.startTime,
    endTime: form.endTime,
    locationName: form.locationName.trim(),
    latitude: parseCoordinate(form.latitude),
    longitude: parseCoordinate(form.longitude),
  };
}

/** Only what changed, so an edit never re-sends (and re-checks) an untouched schedule. */
export function diffGameInput(game: ApiGame, input: CreateGameInput): UpdateGameInput {
  const current = toCreateGameInput(gameToForm(game));
  const changes: UpdateGameInput = {};
  if (input.autoAccept !== current.autoAccept) changes.autoAccept = input.autoAccept;

  if (input.sportId !== current.sportId) changes.sportId = input.sportId;
  if (input.clubId !== current.clubId) changes.clubId = input.clubId;
  if (input.title !== current.title) changes.title = input.title;
  if (input.description !== current.description) changes.description = input.description;
  if (input.requiredPlayers !== current.requiredPlayers) changes.requiredPlayers = input.requiredPlayers;
  if (input.locationName !== current.locationName) changes.locationName = input.locationName;

  if (input.latitude !== current.latitude || input.longitude !== current.longitude) {
    changes.latitude = input.latitude;
    changes.longitude = input.longitude;
  }

  if (
    input.gameDate !== current.gameDate ||
    input.startTime !== current.startTime ||
    input.endTime !== current.endTime
  ) {
    changes.gameDate = input.gameDate;
    changes.startTime = input.startTime;
    changes.endTime = input.endTime;
  }

  return changes;
}

/** "Sunday, October 4" (with the year when it is not the current one). */
export function formatGameDay(date: string, today = deviceMoment().date): string {
  const [year, month, day] = date.split('-').map(Number);
  const sameYear = date.slice(0, 4) === today.slice(0, 4);

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "18:00" -> "6:00 PM". */
export function formatClockTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatGameTimeRange(startTime: string, endTime: string | null): string {
  return endTime ? `${formatClockTime(startTime)} – ${formatClockTime(endTime)}` : formatClockTime(startTime);
}

export function isUpcomingGame(game: Pick<ApiGame, 'status' | 'gameDate'>, today: string): boolean {
  return (game.status === 'OPEN' || game.status === 'FULL' || game.status === 'ACTIVE') && game.gameDate >= today;
}

export interface HostedGameSections {
  upcoming: ApiGame[];
  past: ApiGame[];
}

/** Upcoming soonest first; past, completed, and cancelled games newest first. */
export function splitHostedGames(games: readonly ApiGame[], today: string): HostedGameSections {
  const byStart = [...games].sort(
    (a, b) => a.gameDate.localeCompare(b.gameDate) || a.startTime.localeCompare(b.startTime),
  );

  return {
    upcoming: byStart.filter((game) => isUpcomingGame(game, today)),
    past: byStart.filter((game) => !isUpcomingGame(game, today)).reverse(),
  };
}
