export interface DisplayNameParts {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
}

/** "First Last" when both exist, otherwise whichever name exists, otherwise the username. */
export function formatDisplayName({
  username,
  firstName,
  lastName,
}: DisplayNameParts): string {
  const name = [firstName, lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(' ');

  return name.length > 0 ? name : username;
}
