import type { Club } from '@/types/club';
import type { Game } from '@/types/game';
import type { PlayerSummary } from '@/types/player';
import type { FeedPost } from '@/types/post';
import type { Reel } from '@/types/reel';
import type { SportCategory, SportsLocation } from '@/types/sport';
import { matchesClubFilters } from './clubs';
import { isWithinDistance, matchesSport } from './filters';

export type SearchCategory =
  | 'ALL'
  | 'PLAYERS'
  | 'SPORTS'
  | 'GAMES'
  | 'LOCATIONS'
  | 'POSTS'
  | 'REELS'
  | 'CLUBS';

export const SEARCH_CATEGORIES: readonly { id: SearchCategory; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'PLAYERS', label: 'Players' },
  { id: 'SPORTS', label: 'Sports' },
  { id: 'GAMES', label: 'Games' },
  { id: 'LOCATIONS', label: 'Locations' },
  { id: 'POSTS', label: 'Posts' },
  { id: 'REELS', label: 'Reels' },
  { id: 'CLUBS', label: 'Clubs' },
];

/** Kilometres. `null` means Any distance. */
export type DistanceFilter = 1 | 5 | 10 | 25 | 50 | 100 | null;

export const DISTANCE_FILTERS: readonly DistanceFilter[] = [1, 5, 10, 25, 50, 100, null];

export function formatDistanceFilter(distance: DistanceFilter): string {
  return distance === null ? 'Any' : `${distance} km`;
}

export interface SearchCatalog {
  players: readonly PlayerSummary[];
  sports: readonly SportCategory[];
  games: readonly Game[];
  locations: readonly SportsLocation[];
  posts: readonly FeedPost[];
  reels: readonly Reel[];
  clubs: readonly Club[];
}

export interface SearchResults {
  players: PlayerSummary[];
  sports: SportCategory[];
  games: Game[];
  locations: SportsLocation[];
  posts: FeedPost[];
  reels: Reel[];
  clubs: Club[];
}

export interface SearchOptions {
  query: string;
  category: SearchCategory;
  maxDistanceKm: DistanceFilter;
  sport?: string | null;
}

export function countResults(results: SearchResults): number {
  return Object.values(results).reduce((total, items) => total + items.length, 0);
}

/** Every word of the query appears somewhere in the fields (case-insensitive). An empty query matches. */
export function matchesSearchQuery(query: string, ...fields: string[]): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = fields.join(' ').toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

/**
 * Distance only applies to things with a place (players, games, locations).
 * Completed games are left out, since search is for finding something to join.
 */
export function searchCatalog(catalog: SearchCatalog, options: SearchOptions): SearchResults {
  const sport = options.sport ?? null;
  const matches = (...fields: string[]): boolean => matchesSearchQuery(options.query, ...fields);
  const isNear = (distanceKm: number): boolean => isWithinDistance(distanceKm, options.maxDistanceKm);
  const wants = (category: SearchCategory): boolean =>
    options.category === 'ALL' || options.category === category;

  return {
    players: wants('PLAYERS')
      ? catalog.players.filter(
          (player) =>
            isNear(player.distanceKm) &&
            matchesSport(player.primarySport, sport) &&
            matches(player.displayName, player.username, player.primarySport, player.city),
        )
      : [],
    sports: wants('SPORTS')
      ? catalog.sports.filter((item) => matchesSport(item.name, sport) && matches(item.name))
      : [],
    games: wants('GAMES')
      ? catalog.games.filter(
          (game) =>
            game.status !== 'COMPLETED' &&
            game.status !== 'CANCELLED' &&
            isNear(game.location.distanceKm) &&
            matchesSport(game.sport, sport) &&
            matches(game.title, game.sport, game.location.name, game.location.city, game.host.displayName),
        )
      : [],
    locations: wants('LOCATIONS')
      ? catalog.locations.filter(
          (location) =>
            isNear(location.distanceKm) &&
            matchesSport(location.sports, sport) &&
            matches(location.name, location.city, ...location.sports),
        )
      : [],
    posts: wants('POSTS')
      ? catalog.posts.filter(
          (post) => matchesSport(post.sport, sport) && matches(post.body, post.sport, post.author.displayName),
        )
      : [],
    reels: wants('REELS')
      ? catalog.reels.filter(
          (reel) =>
            matchesSport(reel.sport, sport) &&
            matches(reel.caption, reel.sport, reel.author.displayName, reel.locationName),
        )
      : [],
    clubs: wants('CLUBS')
      ? catalog.clubs
          .filter(
            (club) =>
              matchesClubFilters(club, { maxDistanceKm: options.maxDistanceKm, sport }) &&
              matches(club.name, club.slug, club.sport ?? '', club.city ?? '', club.locationName ?? ''),
          )
          .sort((a, b) => b.memberCount - a.memberCount)
      : [],
  };
}
