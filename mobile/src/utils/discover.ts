import type { Club } from '@/types/club';
import type { Game } from '@/types/game';
import type { PlayerSummary } from '@/types/player';
import type { FeedPost } from '@/types/post';
import type { Reel } from '@/types/reel';
import type { SportCategory } from '@/types/sport';
import { rankPopularClubs } from './clubs';
import { type FeedFilters, NO_FILTERS, isWithinDistance, matchesSport } from './filters';

export const NEARBY_RADIUS_KM = 10;

/** Discover feed filters: GORA-wide, people you know, and your clubs. */
export type DiscoverTab = 'ALL' | 'FRIENDS' | 'CLUBS';

export const DISCOVER_TABS: readonly { id: DiscoverTab; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'FRIENDS', label: 'Friends' },
  { id: 'CLUBS', label: 'Clubs' },
];

export interface DiscoverFeed {
  popularPlayers: PlayerSummary[];
  trendingSports: SportCategory[];
  popularGames: Game[];
  trendingReels: Reel[];
  nearbyActivities: Game[];
  featuredAthletes: PlayerSummary[];
  popularClubs: Club[];
  publicPosts: FeedPost[];
}

/** The header distance wins; without one, "nearby" means the default radius. */
export function getNearbyRadiusKm(filters: FeedFilters): number {
  return filters.maxDistanceKm ?? NEARBY_RADIUS_KM;
}

/** Open games that match the filters, closest first. */
export function pickGamesNearYou(
  games: readonly Game[],
  filters: FeedFilters,
  limit: number,
): Game[] {
  const radius = getNearbyRadiusKm(filters);

  return games
    .filter(
      (game) =>
        game.status === 'OPEN' &&
        game.location.distanceKm <= radius &&
        matchesSport(game.sport, filters.sport),
    )
    .sort((a, b) => a.location.distanceKm - b.location.distanceKm)
    .slice(0, limit);
}

/** Ranking only; the numbers themselves come precomputed from the API. */
export function buildDiscoverFeed(
  input: {
    players: readonly PlayerSummary[];
    sports: readonly SportCategory[];
    games: readonly Game[];
    reels: readonly Reel[];
    clubs?: readonly Club[];
    posts?: readonly FeedPost[];
  },
  filters: FeedFilters = NO_FILTERS,
): DiscoverFeed {
  const players = input.players.filter(
    (player) =>
      isWithinDistance(player.distanceKm, filters.maxDistanceKm) &&
      matchesSport(player.primarySport, filters.sport),
  );
  const upcoming = input.games.filter(
    (game) =>
      game.status !== 'COMPLETED' &&
      game.status !== 'CANCELLED' &&
      isWithinDistance(game.location.distanceKm, filters.maxDistanceKm) &&
      matchesSport(game.sport, filters.sport),
  );

  return {
    popularPlayers: [...players].sort((a, b) => b.followers - a.followers).slice(0, 6),
    trendingSports: input.sports
      .filter((sport) => matchesSport(sport.name, filters.sport))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 6),
    popularGames: [...upcoming]
      .sort((a, b) => b.currentPlayers / b.requiredPlayers - a.currentPlayers / a.requiredPlayers)
      .slice(0, 4),
    trendingReels: input.reels
      .filter((reel) => matchesSport(reel.sport, filters.sport))
      .sort((a, b) => b.views - a.views)
      .slice(0, 6),
    nearbyActivities: pickGamesNearYou(upcoming, filters, upcoming.length),
    featuredAthletes: players.filter((player) => player.featured),
    popularClubs: rankPopularClubs(input.clubs ?? [], filters, 4),
    publicPosts: (input.posts ?? [])
      .filter((post) => post.visibility === 'PUBLIC' && matchesSport(post.sport, filters.sport))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 3),
  };
}
