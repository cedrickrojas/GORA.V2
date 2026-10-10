import type { OwnProfile, ProfileUpdateInput } from '@/types/profile';

/** Same limit as the User_bio_length_check constraint. */
export const PROFILE_BIO_MAX_LENGTH = 160;
/** Same limits as the API DTO and the User_names_check / User_city_check constraints. */
export const PROFILE_NAME_MAX_LENGTH = 50;
export const PROFILE_CITY_MAX_LENGTH = 100;
export const IMAGE_URL_MAX_LENGTH = 2048;

/** Trims the bio and turns an empty one into null, which hides it. */
export function normalizeBio(text: string): string | null {
  const bio = text.trim().replace(/\n{3,}/g, '\n\n');

  return bio.length > 0 ? bio : null;
}

export function isBioTooLong(text: string): boolean {
  return text.trim().length > PROFILE_BIO_MAX_LENGTH;
}

/** Only http(s) links to a real host, including signed cover links from GORA. */
export function isImageUrl(text: string): boolean {
  const value = text.trim();

  if (value.length === 0 || value.length > IMAGE_URL_MAX_LENGTH || /\s/.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** A real calendar date (YYYY-MM-DD) after 1900 and before today, like the API. */
export function isPastDate(value: string, now = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isRealDate && year >= 1900 && date.getTime() < now.getTime();
}

/** The Edit Profile form: plain strings, blank meaning "not set". */
export interface ProfileForm {
  firstName: string;
  lastName: string;
  bio: string;
  city: string;
  dateOfBirth: string;
  profileImageUrl: string;
  coverImageUrl: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileForm, string>>;

export function profileFormFrom(profile: OwnProfile): ProfileForm {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    bio: profile.bio ?? '',
    city: profile.city ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    profileImageUrl: profile.profileImageUrl ?? '',
    coverImageUrl: profile.coverImageUrl ?? '',
  };
}

export function validateProfileForm(form: ProfileForm, now = new Date()): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  const names = [
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
  ] as const;

  for (const [field, label] of names) {
    const value = form[field].trim();

    if (!value) {
      errors[field] = `${label} is required.`;
    } else if (value.length > PROFILE_NAME_MAX_LENGTH) {
      errors[field] = `${label} must be at most ${PROFILE_NAME_MAX_LENGTH} characters.`;
    }
  }

  if (isBioTooLong(form.bio)) {
    errors.bio = `Bio must be at most ${PROFILE_BIO_MAX_LENGTH} characters.`;
  }

  if (form.city.trim().length > PROFILE_CITY_MAX_LENGTH) {
    errors.city = `City must be at most ${PROFILE_CITY_MAX_LENGTH} characters.`;
  }

  if (form.dateOfBirth && !isPastDate(form.dateOfBirth, now)) {
    errors.dateOfBirth = 'Enter a real date in the past.';
  }

  if (form.profileImageUrl.trim() && !isImageUrl(form.profileImageUrl)) {
    errors.profileImageUrl = 'Use a link that starts with https:// (or http://).';
  }

  if (form.coverImageUrl.trim() && !isImageUrl(form.coverImageUrl)) {
    errors.coverImageUrl = 'Use a link that starts with https:// (or http://).';
  }

  return errors;
}

/** Only the fields that changed; a cleared optional field is sent as null. */
export function profileUpdateFrom(form: ProfileForm, original: OwnProfile): ProfileUpdateInput {
  const update: ProfileUpdateInput = {};
  const optional = (text: string): string | null => (text.trim().length > 0 ? text.trim() : null);

  if (form.firstName.trim() !== original.firstName) update.firstName = form.firstName.trim();
  if (form.lastName.trim() !== original.lastName) update.lastName = form.lastName.trim();

  const bio = normalizeBio(form.bio);
  if (bio !== original.bio) update.bio = bio;

  const city = optional(form.city);
  if (city !== original.city) update.city = city;

  const dateOfBirth = optional(form.dateOfBirth);
  if (dateOfBirth !== original.dateOfBirth) update.dateOfBirth = dateOfBirth;

  const profileImageUrl = optional(form.profileImageUrl);
  if (profileImageUrl !== original.profileImageUrl) update.profileImageUrl = profileImageUrl;

  const coverImageUrl = optional(form.coverImageUrl);
  if (coverImageUrl !== original.coverImageUrl) update.coverImageUrl = coverImageUrl;

  return update;
}
