import type { DiscoveredGame } from '@/types/discovery';
import type { JoinRequest } from '@/types/join-request';
import { addDays, deviceMoment, formatClockTime } from './game-form';
import { type JoinRequestAction, joinRequestAction } from './join-requests';
import { type MapPoint, distanceBetweenKm, gamePoint } from './location-map';
import { formatDistanceKm } from './time';

/** Map preview and list row text for a discovered game. Every number comes from the server. */

/** "Today", "Tomorrow", or "Sat, Oct 4". */
export function formatDiscoveryDay(date: string, today = deviceMoment().date): string {
  if (date === today) {
    return 'Today';
  }

  if (date === addDays(today, 1)) {
    return 'Tomorrow';
  }

  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "Today • 6:00 PM". */
export function formatDiscoveryWhen(game: Pick<DiscoveredGame, 'gameDate' | 'startTime'>, today?: string): string {
  return `${formatDiscoveryDay(game.gameDate, today)} • ${formatClockTime(game.startTime)}`;
}

/** "1.2 km away"; null when the server measured no distance. */
export function formatDistanceAway(distanceKm: number | null): string | null {
  if (distanceKm === null) {
    return null;
  }

  return distanceKm < 0.05 ? 'Right here' : `${formatDistanceKm(distanceKm)} away`;
}

export function formatPlayersLine(game: Pick<DiscoveredGame, 'currentPlayers' | 'requiredPlayers'>): string {
  return `Players: ${game.currentPlayers}/${game.requiredPlayers}`;
}

/**
 * The Request to Join state, from the same rules as Game Details. A request the viewer
 * sent or cancelled in this session (join requests store) wins over the search result.
 */
export function discoveryJoinAction(
  game: DiscoveredGame,
  mine: Pick<JoinRequest, 'status'> | null | undefined,
): JoinRequestAction {
  const request = mine !== undefined ? mine : game.myJoinRequestStatus ? { status: game.myJoinRequestStatus } : null;
  return joinRequestAction(game, request);
}

/** Half the visible map width: the chosen radius, else enough to fit every located game. */
export function mapRadiusKm(
  games: readonly DiscoveredGame[],
  center: MapPoint,
  distanceKm: number | null,
): number {
  if (distanceKm !== null) {
    return distanceKm;
  }

  const farthest = games.reduce((max, game) => {
    const point = gamePoint(game);
    return point ? Math.max(max, distanceBetweenKm(center, point)) : max;
  }, 0);

  return Math.min(Math.max(farthest * 1.15, 1), 20_000);
}
