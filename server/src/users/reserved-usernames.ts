/**
 * Usernames that would collide with app routes such as /profile/edit or /profile/settings,
 * or could be mistaken for official accounts.
 */
export const RESERVED_USERNAMES = [
  'activity',
  'admin',
  'api',
  'badges',
  'clubs',
  'edit',
  'followers',
  'following',
  'friends',
  'games',
  'gora',
  'help',
  'me',
  'reels',
  'settings',
  'sports',
  'stories',
  'support',
] as const;
