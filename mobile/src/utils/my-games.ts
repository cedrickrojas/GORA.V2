import type { JoinedGame } from '@/types/game';
import { isUpcomingGame } from './game-form';

export function joinedGameLabel(game: JoinedGame): string {
  if (game.participationStatus === 'ACTIVE') return 'Joined';
  if (game.joinRequestStatus === 'PENDING') return 'Pending approval';
  if (game.joinRequestStatus === 'CANCELLED') return 'Join cancelled';
  if (game.participationStatus === 'LEFT') return 'Join cancelled';
  if (game.participationStatus === 'REMOVED') return 'Removed by host';
  if (game.participationStatus === 'COMPLETED') return 'Completed';
  if (game.joinRequestStatus === 'REJECTED') return 'Request declined';
  return 'Previously joined';
}

export function canCancelJoining(game: JoinedGame, today: string): boolean {
  return (
    (game.status === 'OPEN' || game.status === 'FULL') &&
    game.gameDate >= today &&
    (game.participationStatus === 'ACTIVE' || game.joinRequestStatus === 'PENDING')
  );
}

export function splitJoinedGames(games: readonly JoinedGame[], today: string) {
  const sorted = [...games].sort(
    (a, b) => a.gameDate.localeCompare(b.gameDate) || a.startTime.localeCompare(b.startTime),
  );
  const isCurrent = (game: JoinedGame) =>
    isUpcomingGame(game, today) && (game.participationStatus === 'ACTIVE' || game.joinRequestStatus === 'PENDING');
  return {
    upcoming: sorted.filter(isCurrent),
    past: sorted.filter((game) => !isCurrent(game)).reverse(),
  };
}
