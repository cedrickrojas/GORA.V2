/**
 * A game happens at the venue's wall-clock time: gameDate is a calendar date and
 * startTime/endTime are "HH:mm" on that date. They are stored as timestamp without
 * time zone and are never shifted to another zone. "Today" is decided in GAME_TIMEZONE.
 */

export const GAME_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const GAME_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const GAME_MAX_DAYS_AHEAD = 365;

export interface GameSchedule {
  gameDate: string;
  startTime: string;
  endTime: string;
}

export interface LocalMoment {
  date: string;
  time: string;
}

/** A real calendar date in YYYY-MM-DD form (no 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** gameDate as stored in a DATE column (midnight, read back unchanged). */
export function toGameDate(date: string): Date {
  return toGameDateTime(date, '00:00');
}

/** A wall-clock time on gameDate, as stored in a timestamp-without-time-zone column. */
export function toGameDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
}

export function formatGameDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function formatGameTime(value: Date): string {
  return value.toISOString().slice(11, 16);
}

export function addDays(date: string, days: number): string {
  const start = toGameDate(date);
  start.setUTCDate(start.getUTCDate() + days);
  return formatGameDate(start);
}

/** The current date and time on the clock of the given IANA zone. */
export function localMoment(timeZone: string, now = new Date()): LocalMoment {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '00';

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

/** Whether the stored start (gameDate + startTime) is now or earlier on the given clock. */
export function hasGameStarted(
  gameDate: Date,
  startTime: Date,
  now: LocalMoment,
): boolean {
  const date = formatGameDate(gameDate);
  return (
    date < now.date ||
    (date === now.date &&
      minutesOfDay(formatGameTime(startTime)) <= minutesOfDay(now.time))
  );
}

/** The first problem with a schedule, or null when it can be booked. */
export function scheduleProblem(
  schedule: GameSchedule,
  now: LocalMoment,
): string | null {
  if (schedule.gameDate < now.date) {
    return 'Choose today or a future date.';
  }

  if (schedule.gameDate > addDays(now.date, GAME_MAX_DAYS_AHEAD)) {
    return `Games can be scheduled up to ${GAME_MAX_DAYS_AHEAD} days ahead.`;
  }

  if (minutesOfDay(schedule.endTime) <= minutesOfDay(schedule.startTime)) {
    return 'End time must be after the start time.';
  }

  if (
    schedule.gameDate === now.date &&
    minutesOfDay(schedule.startTime) <= minutesOfDay(now.time)
  ) {
    return 'That start time has already passed. Choose a later time.';
  }

  return null;
}
