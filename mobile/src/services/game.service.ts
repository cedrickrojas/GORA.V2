import type { Game, GameDetails, GameParticipation } from '@/types/game';

export async function fetchGames(): Promise<Game[]> {
  return [];
}

/** Host, capacity, player count, remaining slots, and the roster, all counted by the server. */
export async function fetchGameDetails(gameId: string): Promise<GameDetails | null> {
  void gameId;
  return null;
}

/**
 * Sends a join request. The viewer only becomes a participant once the host
 * accepts, which the backend will report back (and notify about).
 */
export async function requestToJoinGame(gameId: string): Promise<GameParticipation> {
  void gameId;
  return 'REQUESTED';
}
