import { isPastCalendarDate } from '../common/validation/validators';
import {
  DEFAULT_CLUB_MAX_MEMBERS_LIMIT,
  DEFAULT_GAME_TIMEZONE,
  DEFAULT_JWT_EXPIRES_IN,
  readClubMaxMembersLimit,
  readDatabaseUrl,
  readGameTimezone,
  readJwtExpiresIn,
  readJwtSecret,
} from './env.validation';

describe('DATABASE_URL', () => {
  it('accepts configured PostgreSQL URLs and preserves encoded credentials and TLS options', () => {
    const url =
      'postgresql://owner:encoded%40password@db.example.test/neondb?sslmode=require';
    expect(readDatabaseUrl(` ${url} `)).toBe(url);
    expect(
      readDatabaseUrl('postgres://user:password@localhost:5432/gora'),
    ).toBe('postgres://user:password@localhost:5432/gora');
    expect(readDatabaseUrl(undefined)).toBe('');
  });
  it('rejects unmatched quotes, CLI commands, and other URL schemes before serving requests', () => {
    for (const value of [
      '"postgresql://owner:private-password@db.example.test/neondb',
      'postgresql://owner:private-password@db.example.test/neondb"',
      "psql 'postgresql://owner:private-password@db.example.test/neondb'",
      'https://db.example.test/neondb',
      'postgresql://db.example.test/',
    ]) {
      expect(() => readDatabaseUrl(value)).toThrow('DATABASE_URL');
      try {
        readDatabaseUrl(value);
      } catch (error) {
        expect((error as Error).message).not.toContain('private-password');
      }
    }
  });
});

describe('GAME_TIMEZONE', () => {
  it('defaults to Asia/Manila and accepts IANA zones', () => {
    expect(readGameTimezone(undefined)).toBe(DEFAULT_GAME_TIMEZONE);
    expect(readGameTimezone('')).toBe('Asia/Manila');
    expect(readGameTimezone(' Asia/Kuala_Lumpur ')).toBe('Asia/Kuala_Lumpur');
    expect(readGameTimezone('UTC')).toBe('UTC');
  });

  it('rejects unknown zones', () => {
    expect(() => readGameTimezone('Mars/Olympus')).toThrow('GAME_TIMEZONE');
  });
});

describe('CLUB_MAX_MEMBERS_LIMIT', () => {
  it('defaults to 1000 and accepts integers from 1 to 100000', () => {
    expect(readClubMaxMembersLimit(undefined)).toBe(
      DEFAULT_CLUB_MAX_MEMBERS_LIMIT,
    );
    expect(readClubMaxMembersLimit('')).toBe(1000);
    expect(readClubMaxMembersLimit('250')).toBe(250);
    expect(readClubMaxMembersLimit(100000)).toBe(100000);
  });

  it('rejects zero, negative, decimal, huge, and non-numeric limits', () => {
    for (const bad of ['0', '-5', '10.5', '100001', 'many']) {
      expect(() => readClubMaxMembersLimit(bad)).toThrow(
        'CLUB_MAX_MEMBERS_LIMIT',
      );
    }
  });
});

describe('JWT environment validation', () => {
  it('requires a JWT secret of at least 32 characters', () => {
    expect(() => readJwtSecret(undefined)).toThrow('JWT_SECRET');
    expect(() => readJwtSecret('your-jwt-secret')).toThrow('JWT_SECRET');
    expect(readJwtSecret(` ${'x'.repeat(32)} `)).toBe('x'.repeat(32));
  });

  it('defaults JWT_EXPIRES_IN to 7d and rejects malformed durations', () => {
    expect(readJwtExpiresIn(undefined)).toBe(DEFAULT_JWT_EXPIRES_IN);
    expect(readJwtExpiresIn('')).toBe('7d');
    expect(readJwtExpiresIn('15m')).toBe('15m');
    expect(readJwtExpiresIn('3600')).toBe('3600');
    expect(() => readJwtExpiresIn('seven days')).toThrow('JWT_EXPIRES_IN');
  });
});

describe('isPastCalendarDate', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('accepts real past dates only', () => {
    expect(isPastCalendarDate('2000-02-29', now)).toBe(true);
    expect(isPastCalendarDate('2001-02-29', now)).toBe(false);
    expect(isPastCalendarDate('2027-01-01', now)).toBe(false);
    expect(isPastCalendarDate('1899-12-31', now)).toBe(false);
    expect(isPastCalendarDate('12/04/2000', now)).toBe(false);
  });
});
