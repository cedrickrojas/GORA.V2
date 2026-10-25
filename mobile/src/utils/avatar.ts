const AVATAR_TINTS = ['#74818f', '#667584', '#85918f', '#748477', '#86909a', '#6c7e87'];

export function getInitials(displayName: string): string {
  const initials = displayName
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || '?';
}

export function getAvatarTint(userId: string): string {
  let hash = 0;

  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}
