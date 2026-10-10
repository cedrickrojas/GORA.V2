import type { PostLocation } from '@/types/post';
import type { UserSummary } from '@/types/user';

/** Same limits as the server (POST_TAGS_MAX, LOCATION_NAME_MAX_LENGTH). */
export const POST_TAGS_MAX = 20;
export const LOCATION_NAME_MAX_LENGTH = 120;

/** Names shown before "and N others" on a post card. */
const TAG_NAMES_SHOWN = 2;

/** Mirrors the server's tag rules: each person once, never the author, at most POST_TAGS_MAX. */
export function validatePostTags(taggedUserIds: readonly string[], authorId: string | null): string | null {
  if (new Set(taggedUserIds).size !== taggedUserIds.length) {
    return 'Tag each person only once.';
  }

  if (authorId !== null && taggedUserIds.includes(authorId)) {
    return 'You cannot tag yourself.';
  }

  if (taggedUserIds.length > POST_TAGS_MAX) {
    return `You can tag up to ${POST_TAGS_MAX} people.`;
  }

  return null;
}

/** A location is a named place with valid coordinates, or nothing. */
export function validatePostLocation(location: PostLocation | null): string | null {
  if (location === null) {
    return null;
  }

  const name = location.name.trim();

  if (name.length === 0 || name.length > LOCATION_NAME_MAX_LENGTH) {
    return 'Choose a location with a name.';
  }

  if (
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    Math.abs(location.latitude) > 90 ||
    Math.abs(location.longitude) > 180
  ) {
    return 'That location has no valid coordinates.';
  }

  return null;
}

/** Tagged people the viewer can see; the server already leaves out people with a block. */
export function visibleTags(tags: readonly UserSummary[] | undefined, blockedIds: ReadonlySet<string>): UserSummary[] {
  return (tags ?? []).filter((person) => !blockedIds.has(person.id));
}

/** The first names on a card ("with Juan, Maria") and how many more are folded into "and N others". */
export function summarizeTags(tags: readonly UserSummary[]): { shown: UserSummary[]; othersCount: number } {
  const limit = tags.length === TAG_NAMES_SHOWN + 1 ? tags.length : TAG_NAMES_SHOWN;

  return { shown: tags.slice(0, limit), othersCount: Math.max(0, tags.length - limit) };
}
