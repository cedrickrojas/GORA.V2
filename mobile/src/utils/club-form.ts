import type {
  Club,
  ClubActivityDay,
  ClubCreateInput,
  ClubForm,
  ClubMembershipType,
  ClubUpdateInput,
} from '@/types/club';

/**
 * Mirrors server/src/clubs/dto/club.dto.ts so mistakes show inline before submitting.
 * The server validates everything again; these checks are only for the person typing.
 */
export const CLUB_NAME_MIN = 2;
export const CLUB_NAME_MAX = 80;
export const CLUB_USERNAME_MIN = 3;
export const CLUB_USERNAME_MAX = 50;
export const CLUB_DESCRIPTION_MAX = 160;
export const CLUB_ABOUT_MAX = 2000;
export const CLUB_REGION_MAX = 80;
export const CLUB_PLACE_MAX = 120;
export const CLUB_TRAINING_SCHEDULE_MAX = 300;
export const CLUB_ADDITIONAL_SPORTS_MAX = 5;
export const CLUB_RULES_MAX = 20;
export const CLUB_RULE_MAX = 200;
export const CLUB_TAGS_MAX = 10;
/** The platform maximum (server CLUB_MAX_MEMBERS_LIMIT, default 1000). */
export const CLUB_MAX_MEMBERS_LIMIT = 1000;
export const CLUB_MEMBER_PRESETS = [10, 20, 30, 50, 100, 250, 500, 1000] as const;

const USERNAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TAG_PATTERN = /^[a-z0-9]{2,30}$/;
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOCIAL_HOSTS = {
  facebookUrl: { site: 'facebook.com', hosts: [/^([a-z0-9-]+\.)?facebook\.com$/, /^fb\.com$/] },
  instagramUrl: { site: 'instagram.com', hosts: [/^([a-z0-9-]+\.)?instagram\.com$/] },
  tiktokUrl: { site: 'tiktok.com', hosts: [/^([a-z0-9-]+\.)?tiktok\.com$/] },
} as const;

export const MEMBERSHIP_TYPE_OPTIONS: { id: ClubMembershipType; label: string; hint: string }[] = [
  { id: 'OPEN', label: 'Open', hint: 'Anyone can join instantly while there is room.' },
  { id: 'APPROVAL_REQUIRED', label: 'Approval Required', hint: 'People request to join; you or an admin approve them.' },
  { id: 'INVITE_ONLY', label: 'Invite Only', hint: 'Only people you or an admin invite can join.' },
];

export const MEMBERSHIP_TYPE_LABELS: Record<ClubMembershipType, string> = {
  OPEN: 'Open',
  APPROVAL_REQUIRED: 'Approval Required',
  INVITE_ONLY: 'Invite Only',
};

export const ACTIVITY_DAY_LABELS: Record<ClubActivityDay, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

export type ClubFormField = keyof ClubForm | 'location';
export type ClubFormErrors = Partial<Record<ClubFormField, string>>;

export function emptyClubForm(): ClubForm {
  return {
    name: '',
    username: '',
    profileImageUrl: '',
    coverImageUrl: '',
    description: '',
    about: '',
    primarySportId: '',
    additionalSportIds: [],
    country: 'Philippines',
    city: '',
    barangay: '',
    homeCourt: '',
    locationName: '',
    latitude: '',
    longitude: '',
    maxMembers: '50',
    membershipType: 'OPEN',
    isPublic: true,
    rules: [],
    tags: [],
    activityDay: '',
    activityStartTime: '',
    activityEndTime: '',
    trainingSchedule: '',
    contactEmail: '',
    websiteUrl: '',
    facebookUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
  };
}

/** " @Manila-Volleyball " -> "manila-volleyball". */
export function normalizeClubUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

/** "Manila Volleyball Club!" -> "manila-volleyball-club", for the suggested handle. */
export function suggestClubUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CLUB_USERNAME_MAX)
    .replace(/-+$/, '');
}

/** "#Weekend Games" -> "weekendgames", like the server. */
export function normalizeClubTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The typed maximum-members value, or the message explaining what is wrong with it. */
export function checkMaxMembers(
  value: string,
  limit = CLUB_MAX_MEMBERS_LIMIT,
  currentMembers = 0,
): string | null {
  const trimmed = value.trim();

  if (trimmed === '') {
    return 'Maximum members is required.';
  }

  if (!/^-?\d+$/.test(trimmed)) {
    return 'Maximum members must be a whole number.';
  }

  const count = Number(trimmed);

  if (count < 1) {
    return 'Maximum members must be at least 1.';
  }

  if (count > limit) {
    return `Maximum members cannot be more than ${limit}.`;
  }

  if (count < currentMembers) {
    return `Maximum members cannot be lower than the current ${currentMembers} active members.`;
  }

  return null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

function socialProblem(field: keyof typeof SOCIAL_HOSTS, label: string, value: string): string | null {
  const { site, hosts } = SOCIAL_HOSTS[field];

  if (!isHttpUrl(value)) {
    return `${label} link must be an https://${site}/ address.`;
  }

  const host = new URL(value).hostname.toLowerCase();
  return hosts.some((pattern) => pattern.test(host)) ? null : `${label} link must be an https://${site}/ address.`;
}

function tooLong(value: string, max: number, label: string): string | null {
  return value.trim().length > max ? `${label} must be at most ${max} characters.` : null;
}

function minutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

export interface ClubFormContext {
  currentMembers?: number;
  limit?: number;
}

/** Every problem in the form, keyed by field. An empty object means it can be submitted. */
export function validateClubForm(form: ClubForm, context: ClubFormContext = {}): ClubFormErrors {
  const errors: ClubFormErrors = {};
  const set = (field: ClubFormField, message: string | null): void => {
    if (message && !errors[field]) {
      errors[field] = message;
    }
  };

  const name = form.name.trim();
  set('name', name.length < CLUB_NAME_MIN ? `Club name must be at least ${CLUB_NAME_MIN} characters.` : null);
  set('name', tooLong(name, CLUB_NAME_MAX, 'Club name'));

  const username = normalizeClubUsername(form.username);
  if (username.length < CLUB_USERNAME_MIN) {
    set('username', `Club username must be at least ${CLUB_USERNAME_MIN} characters.`);
  } else if (username.length > CLUB_USERNAME_MAX) {
    set('username', `Club username must be at most ${CLUB_USERNAME_MAX} characters.`);
  } else if (!USERNAME_PATTERN.test(username)) {
    set('username', 'Club username can use lowercase letters, numbers, and single hyphens between them.');
  }

  set('description', form.description.trim() === '' ? 'Add a short description.' : null);
  set('description', tooLong(form.description, CLUB_DESCRIPTION_MAX, 'Short description'));
  set('about', tooLong(form.about, CLUB_ABOUT_MAX, 'About the club'));

  for (const [field, label] of [
    ['profileImageUrl', 'Profile photo'],
    ['coverImageUrl', 'Cover photo'],
    ['websiteUrl', 'Website'],
  ] as const) {
    const value = form[field].trim();
    set(field, value && !isHttpUrl(value) ? `${label} must be a valid http(s) URL.` : null);
  }

  set('primarySportId', form.primarySportId ? null : 'Choose a primary sport.');
  set(
    'additionalSportIds',
    form.additionalSportIds.length > CLUB_ADDITIONAL_SPORTS_MAX
      ? `Choose at most ${CLUB_ADDITIONAL_SPORTS_MAX} additional sports.`
      : null,
  );

  set('country', tooLong(form.country, CLUB_REGION_MAX, 'Country'));
  set('city', tooLong(form.city, CLUB_REGION_MAX, 'City / Municipality'));
  set('barangay', tooLong(form.barangay, CLUB_REGION_MAX, 'Barangay'));
  set('homeCourt', tooLong(form.homeCourt, CLUB_PLACE_MAX, 'Home court / venue'));
  set('locationName', tooLong(form.locationName, CLUB_PLACE_MAX, 'Location name'));

  const lat = form.latitude.trim();
  const lng = form.longitude.trim();
  if ((lat === '') !== (lng === '')) {
    set('location', 'Give both latitude and longitude, or neither.');
  } else if (lat !== '') {
    const latitude = Number(lat);
    const longitude = Number(lng);
    set('location', !Number.isFinite(latitude) || Math.abs(latitude) > 90 ? 'Latitude must be between -90 and 90.' : null);
    set(
      'location',
      !Number.isFinite(longitude) || Math.abs(longitude) > 180 ? 'Longitude must be between -180 and 180.' : null,
    );
  }

  set('maxMembers', checkMaxMembers(form.maxMembers, context.limit, context.currentMembers));

  set('rules', form.rules.length > CLUB_RULES_MAX ? `A club can have at most ${CLUB_RULES_MAX} rules.` : null);
  set('rules', form.rules.some((rule) => rule.trim() === '') ? 'Rules cannot be empty.' : null);
  set(
    'rules',
    form.rules.some((rule) => rule.trim().length > CLUB_RULE_MAX)
      ? `Each rule must be at most ${CLUB_RULE_MAX} characters.`
      : null,
  );

  set('tags', form.tags.length > CLUB_TAGS_MAX ? `A club can have at most ${CLUB_TAGS_MAX} tags.` : null);
  set('tags', form.tags.some((tag) => !TAG_PATTERN.test(tag)) ? 'Tags must be 2 to 30 letters or numbers.' : null);

  const start = form.activityStartTime.trim();
  const end = form.activityEndTime.trim();
  set('activityStartTime', start && !TIME_PATTERN.test(start) ? 'Start time must be a time like 18:30.' : null);
  set('activityEndTime', end && !TIME_PATTERN.test(end) ? 'End time must be a time like 18:30.' : null);
  if (start && end && TIME_PATTERN.test(start) && TIME_PATTERN.test(end) && minutes(end) <= minutes(start)) {
    set('activityEndTime', 'End time must be after the start time.');
  }
  set('trainingSchedule', tooLong(form.trainingSchedule, CLUB_TRAINING_SCHEDULE_MAX, 'Training schedule'));

  const email = form.contactEmail.trim();
  set('contactEmail', email && !EMAIL_PATTERN.test(email) ? 'Contact email must be a valid email address.' : null);

  for (const [field, label] of [
    ['facebookUrl', 'Facebook'],
    ['instagramUrl', 'Instagram'],
    ['tiktokUrl', 'TikTok'],
  ] as const) {
    const value = form[field].trim();
    set(field, value ? socialProblem(field, label, value) : null);
  }

  return errors;
}

const optional = (value: string): string | null => value.trim() || null;

/** The request body for POST /clubs; call only when validateClubForm returned no errors. */
export function toClubCreateInput(form: ClubForm): ClubCreateInput {
  const lat = form.latitude.trim();
  const lng = form.longitude.trim();

  return {
    name: form.name.trim(),
    username: normalizeClubUsername(form.username),
    description: form.description.trim(),
    about: optional(form.about),
    profileImageUrl: optional(form.profileImageUrl),
    coverImageUrl: optional(form.coverImageUrl),
    primarySportId: form.primarySportId,
    additionalSportIds: form.additionalSportIds.filter((id) => id !== form.primarySportId),
    country: optional(form.country),
    city: optional(form.city),
    barangay: optional(form.barangay),
    homeCourt: optional(form.homeCourt),
    locationName: optional(form.locationName),
    latitude: lat ? Number(lat) : null,
    longitude: lng ? Number(lng) : null,
    maxMembers: Number(form.maxMembers.trim()),
    membershipType: form.membershipType,
    isPublic: form.isPublic,
    rules: form.rules.map((rule) => rule.trim()),
    tags: form.tags,
    activityDay: form.activityDay || null,
    activityStartTime: optional(form.activityStartTime),
    activityEndTime: optional(form.activityEndTime),
    trainingSchedule: optional(form.trainingSchedule),
    contactEmail: optional(form.contactEmail),
    websiteUrl: optional(form.websiteUrl),
    facebookUrl: optional(form.facebookUrl),
    instagramUrl: optional(form.instagramUrl),
    tiktokUrl: optional(form.tiktokUrl),
  };
}

/** Only the fields that changed, for PATCH /clubs/:id. */
export function toClubUpdateInput(form: ClubForm, original: ClubForm): ClubUpdateInput {
  const next = toClubCreateInput(form);
  const before = toClubCreateInput(original);
  const changes: Record<string, unknown> = {};

  for (const key of Object.keys(next) as (keyof ClubCreateInput)[]) {
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) {
      changes[key] = next[key];
    }
  }

  return changes as ClubUpdateInput;
}

/** The Manage Club form, prefilled from the club. */
export function clubToForm(club: Club): ClubForm {
  const text = (value: string | null): string => value ?? '';

  return {
    name: club.name,
    username: club.slug,
    profileImageUrl: text(club.profileImageUrl),
    coverImageUrl: text(club.coverImageUrl),
    description: text(club.description),
    about: text(club.about),
    primarySportId: text(club.sportId),
    additionalSportIds: club.additionalSports.map((sport) => sport.id),
    country: text(club.country),
    city: text(club.city),
    barangay: text(club.barangay),
    homeCourt: text(club.homeCourt),
    locationName: text(club.locationName),
    latitude: club.latitude === null ? '' : String(club.latitude),
    longitude: club.longitude === null ? '' : String(club.longitude),
    maxMembers: String(club.maxMembers),
    membershipType: club.membershipType,
    isPublic: club.isPublic,
    rules: [...club.rules],
    tags: [...club.tags],
    activityDay: club.schedule.day ?? '',
    activityStartTime: text(club.schedule.startTime),
    activityEndTime: text(club.schedule.endTime),
    trainingSchedule: text(club.schedule.trainingSchedule),
    contactEmail: text(club.contact.email),
    websiteUrl: text(club.contact.websiteUrl),
    facebookUrl: text(club.contact.facebookUrl),
    instagramUrl: text(club.contact.instagramUrl),
    tiktokUrl: text(club.contact.tiktokUrl),
  };
}
