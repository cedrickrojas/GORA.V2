import {
  addDays,
  formatGameDate,
  formatGameTime,
  hasGameStarted,
  isCalendarDate,
  localMoment,
  scheduleProblem,
  toGameDate,
  toGameDateTime,
} from './game-schedule';

describe('game schedule', () => {
  const now = { date: '2026-09-30', time: '14:05' };
  const schedule = (gameDate: string, startTime: string, endTime: string) =>
    scheduleProblem({ gameDate, startTime, endTime }, now);

  it('keeps the wall-clock date and time exactly as entered', () => {
    const start = toGameDateTime('2026-10-04', '18:00');
    expect(start.toISOString()).toBe('2026-10-04T18:00:00.000Z');
    expect(formatGameDate(start)).toBe('2026-10-04');
    expect(formatGameTime(start)).toBe('18:00');
    expect(formatGameDate(toGameDate('2026-12-31'))).toBe('2026-12-31');
  });

  it('accepts real calendar dates only', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('04/10/2026')).toBe(false);
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-09-30', 365)).toBe('2027-09-30');
  });

  it('reads the date and time on the clock of the given zone', () => {
    const instant = new Date('2026-09-30T17:30:00Z');
    expect(localMoment('Asia/Manila', instant)).toEqual({
      date: '2026-10-01',
      time: '01:30',
    });
    expect(localMoment('UTC', instant)).toEqual({
      date: '2026-09-30',
      time: '17:30',
    });
  });

  it('accepts a later time today and any time on a future date', () => {
    expect(schedule('2026-09-30', '18:00', '20:00')).toBeNull();
    expect(schedule('2026-10-04', '06:00', '07:30')).toBeNull();
    expect(schedule('2027-09-30', '06:00', '07:30')).toBeNull();
  });

  it('rejects past dates and dates more than a year ahead', () => {
    expect(schedule('2026-09-29', '18:00', '20:00')).toBe(
      'Choose today or a future date.',
    );
    expect(schedule('2027-10-01', '18:00', '20:00')).toContain('365 days');
  });

  it('rejects an end time that is equal to or before the start time', () => {
    expect(schedule('2026-10-04', '18:00', '18:00')).toBe(
      'End time must be after the start time.',
    );
    expect(schedule('2026-10-04', '18:00', '17:00')).toBe(
      'End time must be after the start time.',
    );
  });

  it('knows when a stored game has started', () => {
    const start = (date: string, time: string) =>
      hasGameStarted(toGameDate(date), toGameDateTime(date, time), now);
    expect(start('2026-09-29', '23:00')).toBe(true);
    expect(start('2026-09-30', '14:05')).toBe(true);
    expect(start('2026-09-30', '14:06')).toBe(false);
    expect(start('2026-10-01', '06:00')).toBe(false);
  });

  it('rejects a start time that already passed today', () => {
    expect(schedule('2026-09-30', '14:00', '16:00')).toContain(
      'already passed',
    );
    expect(schedule('2026-09-30', '14:05', '16:00')).toContain(
      'already passed',
    );
  });
});
