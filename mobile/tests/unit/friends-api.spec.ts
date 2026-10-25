import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/stores/auth';
import { useFriendsStore } from '@/stores/friends';
import { usePostsStore } from '@/stores/posts';
import type { FriendsSnapshot } from '@/services/friends-api.service';
import type { ApiPost } from '@/types/post';

const api = vi.hoisted(() => ({
  getFriends: vi.fn(),
  acceptFriendRequest: vi.fn(),
  dismissFriendRequest: vi.fn(),
  sendFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  unblockFriend: vi.fn(),
  listFeed: vi.fn(),
  listUserPosts: vi.fn(),
}));
vi.mock('@/services/friends-api.service', () => api);
vi.mock('@/services/posts-api.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/posts-api.service')>()),
  listFeed: api.listFeed,
  listUserPosts: api.listUserPosts,
}));

const me = '11111111-1111-4111-8111-111111111111';
const friend = {
  id: '22222222-2222-4222-8222-222222222222',
  username: 'teammate',
  displayName: 'Team Mate',
  avatarUrl: null,
  city: 'Manila',
  primarySport: '',
  distanceKm: 0,
  followers: 0,
  gamesCompleted: 0,
  featured: false,
};
const pending: FriendsSnapshot = {
  friends: [],
  blockedIds: [],
  requests: [
    { id: 'request-1', direction: 'RECEIVED', player: friend, mutualFriends: 0, createdAt: '2026-10-10T03:00:00Z' },
  ],
};
const accepted: FriendsSnapshot = { friends: [friend], requests: [], blockedIds: [] };
const post: ApiPost = {
  id: '33333333-3333-4333-8333-333333333333',
  author: { id: friend.id, username: friend.username, firstName: 'Team', lastName: 'Mate', profileImageUrl: null },
  caption: 'Friends game tonight!',
  visibility: 'FRIENDS',
  sport: null,
  sportId: null,
  clubId: null,
  isAnnouncement: false,
  media: [],
  tags: [],
  location: null,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  likedByViewer: false,
  editedAt: null,
  createdAt: '2026-10-10T03:00:00Z',
  updatedAt: '2026-10-10T03:00:00Z',
};

describe('signed-in friendship and feed synchronization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.currentUser = {
      id: me,
      username: 'viewer',
      email: 'viewer@example.test',
      firstName: 'View',
      lastName: 'Er',
      role: 'USER',
      profileImageUrl: null,
      bio: null,
      city: null,
    };
    auth.accessToken = 'viewer-token';
    api.getFriends.mockResolvedValue(pending);
    api.listFeed.mockResolvedValue({ posts: [], nextCursor: null });
    api.listUserPosts.mockResolvedValue({ posts: [], nextCursor: null });
  });

  test('signed-in accounts load real requests and show no sample posts or friends', async () => {
    const posts = usePostsStore();
    await posts.load();
    const friends = useFriendsStore();
    expect(api.getFriends).toHaveBeenCalledWith('viewer-token');
    expect(friends.received).toEqual(pending.requests);
    expect(friends.friends).toEqual([]);
    expect(posts.visiblePosts).toEqual([]);
    expect(api.listFeed).toHaveBeenCalledWith('viewer-token', 'FRIENDS');
  });

  test('acceptance waits for the API and refreshes Friends posts without navigation', async () => {
    const posts = usePostsStore();
    await posts.load();
    const friends = useFriendsStore();
    let finish!: (snapshot: FriendsSnapshot) => void;
    api.acceptFriendRequest.mockImplementation(
      () =>
        new Promise<FriendsSnapshot>((resolve) => {
          finish = resolve;
        }),
    );
    const accepting = friends.accept('request-1');
    expect(friends.friendIds.has(friend.id)).toBe(false);
    expect(friends.busyId).toBe('request-1');
    api.listFeed.mockResolvedValue({ posts: [post], nextCursor: null });
    finish(accepted);
    expect(await accepting).toBe(true);
    await vi.waitFor(() => expect(posts.friendPosts.map((item) => item.id)).toEqual([post.id]));
    expect(friends.relationshipWith(me, friend.id)).toBe('FRIENDS');
    expect(friends.received).toEqual([]);
    expect(posts.serverStatus).toBe('ready');
  });

  test('a rejected API action retains the request and never claims friendship', async () => {
    const friends = useFriendsStore();
    await friends.load();
    api.acceptFriendRequest.mockRejectedValue(new ApiError(404, 'This friend request is no longer available.'));
    expect(await friends.accept('request-1')).toBe(false);
    expect(friends.friends).toEqual([]);
    expect(friends.received).toHaveLength(1);
    expect(friends.error).toMatch(/no longer available/);
    expect(friends.busyId).toBeNull();
  });

  test('an old account response cannot restore friends after switching accounts', async () => {
    const friends = useFriendsStore();
    let finish!: (snapshot: FriendsSnapshot) => void;
    api.getFriends.mockImplementation(
      () =>
        new Promise<FriendsSnapshot>((resolve) => {
          finish = resolve;
        }),
    );
    const loading = friends.refresh();
    useAuthStore().currentUser = { ...useAuthStore().currentUser!, id: friend.id, username: friend.username };
    await nextTick();
    finish(accepted);
    await loading;
    expect(friends.friends).toEqual([]);
    expect(friends.requests).toEqual([]);
    expect(friends.isLoaded).toBe(false);
  });
});
