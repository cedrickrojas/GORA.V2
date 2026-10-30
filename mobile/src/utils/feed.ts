import type { FeedActivity, HomeFeedItem } from '@/types/feed';
import type { Game } from '@/types/game';
import type { FeedPost, PostDraft } from '@/types/post';
import type { Reel } from '@/types/reel';
import { getNearbyRadiusKm } from './discover';
import { type FeedFilters, NO_FILTERS, matchesSport } from './filters';
import { validatePostLocation, validatePostTags } from './post-details';
import { validatePostAudience } from './post-privacy';

export const POST_CAPTION_MAX_LENGTH = 2200;
export const POST_PHOTO_LIMIT = 10;

export interface HomeFeedSources {
  posts: readonly FeedPost[];
  games: readonly Game[];
  reels: readonly Reel[];
  activities: readonly FeedActivity[];
}

export interface HomeFeedLimits {
  /** Reels are previews in Home; the full feed lives on the Reels tab. */
  reels: number;
}

const DEFAULT_LIMITS: HomeFeedLimits = { reels: 2 };

/** Games still worth joining or watching; cancelled and finished games stay off Home. */
function isFeedGame(game: Game): boolean {
  return game.status !== 'CANCELLED' && game.status !== 'COMPLETED';
}

/**
 * Merges posts, game posts, reel previews, and activity into one list,
 * newest first. Plain chronological order: no ranking algorithm yet.
 */
export function buildHomeFeed(
  sources: HomeFeedSources,
  filters: FeedFilters = NO_FILTERS,
  limits: HomeFeedLimits = DEFAULT_LIMITS,
): HomeFeedItem[] {
  const radiusKm = getNearbyRadiusKm(filters);
  const bySport = <T extends { sport: string }>(item: T): boolean => matchesSport(item.sport, filters.sport);

  const posts: HomeFeedItem[] = sources.posts.filter(bySport).map((post) => ({
    type: 'POST',
    id: `post:${post.id}`,
    at: Date.parse(post.createdAt),
    post,
  }));

  const games: HomeFeedItem[] = sources.games
    .filter((game) => isFeedGame(game) && game.location.distanceKm <= radiusKm && bySport(game))
    .map((game) => ({ type: 'GAME', id: `game:${game.id}`, at: Date.parse(game.createdAt), game }));

  const reels: HomeFeedItem[] = [...sources.reels]
    .filter(bySport)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limits.reels)
    .map((reel) => ({ type: 'REEL', id: `reel:${reel.id}`, at: Date.parse(reel.createdAt), reel }));

  const activities: HomeFeedItem[] = sources.activities.filter(bySport).map((activity) => ({
    type: 'ACTIVITY',
    id: `activity:${activity.id}`,
    at: Date.parse(activity.createdAt),
    activity,
  }));

  return [...posts, ...games, ...reels, ...activities].sort((a, b) => b.at - a.at);
}

const ALL_REELS: HomeFeedLimits = { reels: Number.POSITIVE_INFINITY };

/**
 * Discover > Friends: posts, games, reels, and activity from accepted friends
 * and followed accounts. Friendship and following stay separate relationships;
 * this tab simply reads both.
 */
export function buildFriendsFeed(
  sources: HomeFeedSources,
  circleIds: readonly string[],
  filters: FeedFilters = NO_FILTERS,
): HomeFeedItem[] {
  const circle = new Set(circleIds);

  return buildHomeFeed(
    {
      posts: sources.posts.filter((post) => circle.has(post.author.id)),
      games: sources.games.filter((game) => circle.has(game.host.id)),
      reels: sources.reels.filter((reel) => circle.has(reel.author.id)),
      activities: sources.activities.filter((activity) => circle.has(activity.actor.id)),
    },
    filters,
    ALL_REELS,
  );
}

/** Discover > Clubs: posts, announcements, games, and reels from clubs the viewer joined or follows. */
export function buildClubsFeed(
  sources: HomeFeedSources,
  clubIds: readonly string[],
  filters: FeedFilters = NO_FILTERS,
): HomeFeedItem[] {
  const clubs = new Set(clubIds);
  const inClubs = (item: { club?: { id: string } | null }): boolean => !!item.club && clubs.has(item.club.id);

  return buildHomeFeed(
    {
      posts: sources.posts.filter(inClubs),
      games: sources.games.filter(inClubs),
      reels: sources.reels.filter(inClubs),
      activities: [],
    },
    filters,
    ALL_REELS,
  );
}

/**
 * A post needs a caption or at least one photo, a valid audience for its visibility,
 * valid tags, and either no location or a complete one.
 */
export function canPublishPost(draft: PostDraft, authorId: string | null = null): boolean {
  const caption = draft.body.trim();

  return (
    (caption.length > 0 || draft.photoUrls.length > 0 || Boolean(draft.sharedPostId)) &&
    caption.length <= POST_CAPTION_MAX_LENGTH &&
    draft.photoUrls.length <= POST_PHOTO_LIMIT &&
    draft.sport.length > 0 &&
    validatePostAudience(draft.visibility, draft.customViewerIds, authorId) === null &&
    validatePostTags(draft.taggedUserIds, authorId) === null &&
    validatePostLocation(draft.location) === null
  );
}
