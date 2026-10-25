import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import {
  buildMockActivities,
  buildMockGames,
  buildMockPosts,
  buildMockReels,
} from '@/services/mock/mock-catalog';
import { buildMockFollowSummary } from '@/services/mock/mock-profile';
import { mockCurrentUser, mockUsers } from '@/services/mock/mock-users';
import { useFollowsStore } from '@/stores/follows';
import { usePostsStore } from '@/stores/posts';
import type { PostDraft } from '@/types/post';
import { NEARBY_RADIUS_KM } from '@/utils/discover';
import { POST_PHOTO_LIMIT, buildHomeFeed, canPublishPost, type HomeFeedSources } from '@/utils/feed';
import { applyFollowChange, canFollow } from '@/utils/follows';
import { DEFAULT_REELS_TAB, REELS_TABS, selectFollowingReels, selectForYouReels } from '@/utils/reels';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');

function sources(): HomeFeedSources {
  return {
    posts: buildMockPosts(NOW),
    games: buildMockGames(NOW),
    reels: buildMockReels(NOW),
    activities: buildMockActivities(NOW),
  };
}

function draft(fields: Partial<PostDraft> = {}): PostDraft {
  return {
    body: 'Great run tonight.',
    sport: 'Basketball',
    visibility: 'PUBLIC',
    customViewerIds: [],
    taggedUserIds: [],
    location: null,
    photoUrls: [],
    ...fields,
  };
}

describe('Home newsfeed', () => {
  test('mixes all four content types, newest first', () => {
    const feed = buildHomeFeed(sources());

    expect(new Set(feed.map((item) => item.type))).toEqual(new Set(['POST', 'GAME', 'REEL', 'ACTIVITY']));
    expect(feed.every((item, index) => index === 0 || feed[index - 1].at >= item.at)).toBe(true);
    expect(new Set(feed.map((item) => item.id)).size).toBe(feed.length);
  });

  test('game posts carry the host note and skip cancelled or completed games', () => {
    const games = buildHomeFeed(sources()).flatMap((item) => (item.type === 'GAME' ? [item.game] : []));
    const riverside = games.find((game) => game.id === 'game-volley-riverside-evening');

    expect(riverside?.description).toBe('Looking for players tonight!');
    expect(riverside && `${riverside.currentPlayers}/${riverside.requiredPlayers}`).toBe('3/12');
    expect(games.some((game) => game.status === 'CANCELLED' || game.status === 'COMPLETED')).toBe(false);
    expect(games.every((game) => game.location.distanceKm <= NEARBY_RADIUS_KM)).toBe(true);
  });

  test('reels appear as a limited number of previews', () => {
    const reels = buildHomeFeed(sources()).filter((item) => item.type === 'REEL');

    expect(reels).toHaveLength(2);
  });

  test('the header sport filter narrows every content type', () => {
    const feed = buildHomeFeed(sources(), { maxDistanceKm: null, sport: 'Volleyball' });
    const sportOf = (item: (typeof feed)[number]): string => {
      switch (item.type) {
        case 'POST':
          return item.post.sport;
        case 'GAME':
          return item.game.sport;
        case 'REEL':
          return item.reel.sport;
        case 'ACTIVITY':
          return item.activity.sport;
      }
    };

    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((item) => sportOf(item) === 'Volleyball')).toBe(true);
  });
});

describe('Create Post', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('needs a caption or a photo, a sport, and at most the photo limit', () => {
    expect(canPublishPost(draft())).toBe(true);
    expect(canPublishPost(draft({ body: '   ', photoUrls: ['blob:photo-1'] }))).toBe(true);
    expect(canPublishPost(draft({ body: '   ' }))).toBe(false);
    expect(canPublishPost(draft({ sport: '' }))).toBe(false);
    expect(
      canPublishPost(draft({ photoUrls: Array.from({ length: POST_PHOTO_LIMIT + 1 }, (_, i) => `blob:${i}`) })),
    ).toBe(false);
  });

  test('a published post shows on Home and on the author profile', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const store = usePostsStore();
    await store.load();

    const post = await store.publish(
      mockCurrentUser,
      draft({ body: '  Won 21-18!  ', visibility: 'FRIENDS', photoUrls: ['blob:a', 'blob:b'] }),
    );

    expect(post?.body).toBe('Won 21-18!');
    expect(post?.media.map((item) => item.url)).toEqual(['blob:a', 'blob:b']);
    expect(store.byAuthor(mockCurrentUser.id)[0]?.id).toBe(post?.id);

    const home = buildHomeFeed({ ...sources(), posts: store.posts });
    expect(home[0]).toMatchObject({ type: 'POST', post: { id: post?.id } });
  });

  test('liking toggles the count once per viewer', async () => {
    const store = usePostsStore();
    await store.load();
    const before = store.posts.find((post) => post.id === 'feed-post-1')!.likes;

    store.toggleLike('feed-post-1');
    expect(store.posts.find((post) => post.id === 'feed-post-1')).toMatchObject({ likes: before + 1, likedByViewer: true });
    store.toggleLike('feed-post-1');
    expect(store.posts.find((post) => post.id === 'feed-post-1')).toMatchObject({ likes: before, likedByViewer: false });
  });
});

describe('follows', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('nobody can follow themselves', () => {
    expect(canFollow(mockCurrentUser.id, mockCurrentUser.id)).toBe(false);
    expect(canFollow(null, mockUsers.kim.id)).toBe(false);
    expect(canFollow(mockCurrentUser.id, mockUsers.kim.id)).toBe(true);
  });

  test('following twice does not double count', () => {
    const summary = buildMockFollowSummary();
    const once = applyFollowChange(summary, mockUsers.kim.id, true);

    expect(once.followingCount).toBe(summary.followingCount + 1);
    expect(applyFollowChange(once, mockUsers.kim.id, true)).toBe(once);
    expect(applyFollowChange(once, mockUsers.kim.id, false).followingCount).toBe(summary.followingCount);
  });

  test('the store toggles Follow and Following', async () => {
    const store = useFollowsStore();
    await store.load();
    const count = store.followingCount;

    expect(store.isFollowing(mockUsers.kim.id)).toBe(false);
    await store.toggleFollow(mockUsers.kim.id);
    expect(store.isFollowing(mockUsers.kim.id)).toBe(true);
    expect(store.followingCount).toBe(count + 1);

    await store.toggleFollow(mockCurrentUser.id);
    expect(store.followingCount).toBe(count + 1);
  });
});

describe('Reels tabs', () => {
  test('are Following and For You, opening on For You', () => {
    expect(REELS_TABS.map((tab) => tab.label)).toEqual(['Following', 'For You']);
    expect(DEFAULT_REELS_TAB).toBe('FOR_YOU');
  });

  test('Following only shows followed accounts, newest first', () => {
    const reels = buildMockReels(NOW);
    const following = selectFollowingReels(reels, buildMockFollowSummary().followingIds);

    expect(following.map((reel) => reel.author.id)).toEqual([mockUsers.maria.id, mockUsers.john.id]);
    expect(selectFollowingReels(reels, [])).toEqual([]);
  });

  test('For You keeps every reel', () => {
    const reels = buildMockReels(NOW);

    expect(selectForYouReels(reels)).toHaveLength(reels.length);
  });
});
