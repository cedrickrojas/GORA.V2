import type { Game, GameDetails, GamePlayer } from '@/types/game';
import type { UserSummary } from '@/types/user';
import { getPlayerCount, summarizeGameCapacity } from '@/utils/games';
import { mockCurrentUser, mockUsers } from './mock-users';

/** Games whose host also joined as a player. Everyone else only organizes. */
const HOSTS_WHO_PLAY = new Set([
  'game-volley-riverside-evening',
  'game-volley-sat',
  'game-hoops-night',
  'game-tennis-full',
  'game-volley-last-week',
]);

function guest(index: number): UserSummary {
  return { id: `user-guest-${index}`, username: `player${index}`, displayName: `Player ${index}`, avatarUrl: null };
}

/** Stands in for the Game Details API: the roster length is the player count. */
export function buildMockGameDetails(game: Game): GameDetails {
  const size = getPlayerCount(game);
  const status = game.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE';
  const roster: UserSummary[] = [];

  if (HOSTS_WHO_PLAY.has(game.id)) {
    roster.push(game.host);
  }
  if (game.participation === 'PARTICIPANT' && game.host.id !== mockCurrentUser.id) {
    roster.push(mockCurrentUser);
  }
  for (const user of Object.values(mockUsers)) {
    if (!roster.some((member) => member.id === user.id) && user.id !== game.host.id) {
      roster.push(user);
    }
  }
  for (let index = roster.length + 1; roster.length < size; index += 1) {
    roster.push(guest(index));
  }

  const players: GamePlayer[] = roster.slice(0, size).map((user) => ({
    user,
    status,
    isHost: user.id === game.host.id,
  }));

  const capacity = summarizeGameCapacity(game.requiredPlayers, players.length);

  return { ...game, ...capacity, players };
}
