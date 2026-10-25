import type { UserSummary } from '@/types/user';

export const mockCurrentUser: UserSummary = {
  id: 'user-louis',
  username: 'louis',
  displayName: 'Louis Tabernero',
  avatarUrl: null,
};

export const mockUsers = {
  john: { id: 'user-john', username: 'john', displayName: 'John Reyes', avatarUrl: null },
  maria: { id: 'user-maria', username: 'maria', displayName: 'Maria Santos', avatarUrl: null },
  alex: { id: 'user-alex', username: 'alex', displayName: 'Alex Cruz', avatarUrl: null },
  mark: { id: 'user-mark', username: 'mark', displayName: 'Mark Villanueva', avatarUrl: null },
  sam: { id: 'user-sam', username: 'sam', displayName: 'Sam Dizon', avatarUrl: null },
  kim: { id: 'user-kim', username: 'kim', displayName: 'Kim Navarro', avatarUrl: null },
  paolo: { id: 'user-paolo', username: 'paolo', displayName: 'Paolo Garcia', avatarUrl: null },
  bea: { id: 'user-bea', username: 'bea', displayName: 'Bea Lim', avatarUrl: null },
  carlo: { id: 'user-carlo', username: 'carlo', displayName: 'Carlo Mendoza', avatarUrl: null },
} satisfies Record<string, UserSummary>;
