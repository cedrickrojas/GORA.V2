import type { UserSummary } from '@/types/user';

export interface DisplayNameParts {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * "First Last" when both exist, otherwise whichever name exists, otherwise the username.
 * The same rule as the server's formatDisplayName; use this instead of joining names inline.
 */
export function formatDisplayName({ username, firstName, lastName }: DisplayNameParts): string {
  const name = [firstName, lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');

  return name.length > 0 ? name : username;
}

/** The avatar/name shape used across the app, from any API user with names and a photo URL. */
export function toUserSummary(user: DisplayNameParts & { id: string; profileImageUrl: string | null }): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: formatDisplayName(user),
    avatarUrl: user.profileImageUrl,
  };
}
