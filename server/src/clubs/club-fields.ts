import type {
  ClubActivityDay,
  ClubMembershipType,
} from '../generated/prisma/client';

export const CLUB_NAME_MIN_LENGTH = 2;
export const CLUB_NAME_MAX_LENGTH = 80;
export const CLUB_USERNAME_MIN_LENGTH = 3;
export const CLUB_USERNAME_MAX_LENGTH = 50;
/** Same rule as the Club_slug_format_check constraint. */
export const CLUB_USERNAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const CLUB_DESCRIPTION_MAX_LENGTH = 160;
export const CLUB_ABOUT_MAX_LENGTH = 2000;
export const CLUB_REGION_MAX_LENGTH = 80;
export const CLUB_PLACE_MAX_LENGTH = 120;
export const CLUB_TRAINING_SCHEDULE_MAX_LENGTH = 300;
export const CLUB_ADDITIONAL_SPORTS_MAX = 5;
export const CLUB_RULES_MAX = 20;
export const CLUB_RULE_MAX_LENGTH = 200;
export const CLUB_TAGS_MAX = 10;
export const CLUB_TAG_PATTERN = /^[a-z0-9]{2,30}$/;
export const CLUB_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const CLUB_EMAIL_MAX_LENGTH = 254;
export const CLUB_URL_MAX_LENGTH = 2048;

export const CLUB_MEMBERSHIP_TYPES = [
  'OPEN',
  'APPROVAL_REQUIRED',
  'INVITE_ONLY',
] as const satisfies readonly ClubMembershipType[];

export const CLUB_ACTIVITY_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const satisfies readonly ClubActivityDay[];

/** Social links must point at the network they are labelled as. */
export const CLUB_SOCIAL_HOSTS = {
  facebookUrl: [/^([a-z0-9-]+\.)?facebook\.com$/, /^fb\.com$/],
  instagramUrl: [/^([a-z0-9-]+\.)?instagram\.com$/],
  tiktokUrl: [/^([a-z0-9-]+\.)?tiktok\.com$/],
} as const;

/** " @Manila-Volleyball " -> "manila-volleyball". Validation then checks the pattern. */
export function normalizeClubUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

/** "#Weekend Games" -> "weekendgames": lowercase letters and digits only. */
export function normalizeClubTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalizes every tag and drops duplicates, keeping the first occurrence. */
export function normalizeClubTags(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeClubTag))];
}

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
