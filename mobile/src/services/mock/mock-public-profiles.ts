import type { PublicProfile } from '@/types/profile';
import type { UserSummary } from '@/types/user';
import { mockPlayers } from './mock-catalog';
import { mockUsers } from './mock-users';

const BIOS: Record<string, string> = {
  john: 'Point guard. Full-court runs at Rizal Park most weeknights.',
  maria: 'Libero and weekend beach volleyball coach.',
  alex: 'Winger. Always looking for a 7-a-side game.',
  kim: 'Marathoner in training. Sunday long runs.',
  paolo: 'Pickleball open play organizer in Alabang.',
  bea: 'Lap swimmer. Mornings only.',
  carlo: 'Imus Volleyball Club moderator.',
};

function splitName(user: UserSummary): { firstName: string; lastName: string } {
  const [firstName = user.username, ...rest] = user.displayName.split(' ');

  return { firstName, lastName: rest.join(' ') };
}

/** Everyone except the viewer, keyed by username. */
export function buildMockPublicProfiles(): PublicProfile[] {
  const players = mockPlayers.map((player, index) => ({
    user: player as UserSummary,
    sport: player.primarySport,
    city: player.city as string | null,
    followers: player.followers,
    games: player.gamesCompleted,
    index,
  }));
  const others = [{ user: mockUsers.carlo, sport: 'Volleyball', city: 'Imus', followers: 410, games: 22, index: players.length }];

  return [...players, ...others].map(({ user, sport, city, followers, games, index }) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    ...splitName(user),
    bio: BIOS[user.username] ?? null,
    city,
    coverImageUrl: null,
    sports: [{ id: `${user.id}-${sport}`, name: sport, role: 'Player' }],
    friendsCount: 40 + index * 7,
    followersCount: followers,
    followingCount: 120 + index * 11,
    gamesCompleted: games,
    badgesUnlocked: Math.min(13, 3 + index),
  }));
}
