import type { Game, GameDetails, GameParticipation } from '@/types/game';
import { buildMockGames } from './mock/mock-catalog';
import { buildMockGameDetails } from './mock/mock-rosters';

export async function fetchGames(): Promise<Game[]> {
  return buildMockGames(Date.now());
}

/** Host, capacity, player count, remaining slots, and the roster, all counted by the server. */
export async function fetchGameDetails(gameId: string): Promise<GameDetails | null> {
  const game = buildMockGames(Date.now()).find((candidate) => candidate.id === gameId);

  return game ? buildMockGameDetails(game) : null;
}

/**
 * Sends a join request. The viewer only becomes a participant once the host
 * accepts, which the backend will report back (and notify about).
 */
export async function requestToJoinGame(gameId: string): Promise<GameParticipation> {
  void gameId;
  return 'REQUESTED';
}
