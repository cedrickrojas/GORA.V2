/** Your own name opens your Profile tab; anyone else opens their public profile at /profile/:username. */
export function userProfilePath(username: string, viewerUsername?: string | null): string {
  return username === viewerUsername ? '/profile' : `/profile/${encodeURIComponent(username)}`;
}
