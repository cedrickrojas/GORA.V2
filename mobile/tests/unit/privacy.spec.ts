import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { routerKey } from 'vue-router';
import PostCard from '@/components/feed/PostCard.vue';
import { buildMockPosts } from '@/services/mock/mock-catalog';
import { mockCurrentUser, mockUsers } from '@/services/mock/mock-users';
import { useAuthStore } from '@/stores/auth';
import { useChatStore } from '@/stores/chat';
import { useFriendsStore } from '@/stores/friends';
import { usePostsStore } from '@/stores/posts';
import { useSessionStore } from '@/stores/session';
import type { FeedPost } from '@/types/post';
import { canPublishPost } from '@/utils/feed';
import {
  POST_PRIVACY_OPTIONS,
  canViewPost,
  validatePostAudience,
  type PostViewer,
} from '@/utils/post-privacy';
import { userProfilePath } from '@/utils/profile-links';
import { messageAccessFor, profileActionsFor, resolveRelationship } from '@/utils/relationship';

const NOW = Date.parse('2026-09-30T12:00:00.000Z');
const AUTHOR = mockUsers.maria;

function post(fields: Partial<FeedPost>): FeedPost {
  return {
    id: 'post-under-test',
    author: AUTHOR,
    body: 'Hello',
    sport: 'Volleyball',
    media: [],
    visibility: 'PUBLIC',
    createdAt: new Date(NOW).toISOString(),
    likes: 0,
    comments: 0,
    shares: 0,
    likedByViewer: false,
    ...fields,
  };
}

function viewer(id: string, fields: Partial<PostViewer> = {}): PostViewer {
  return { id, friendIds: new Set(), blockedIds: new Set(), ...fields };
}

describe('post privacy', () => {
  const friend = viewer('friend', { friendIds: new Set([AUTHOR.id]) });
  const stranger = viewer('stranger');
  const chosen = viewer('chosen');
  const author = viewer(AUTHOR.id);

  test('the selector offers Public, Friends, Custom, and Only Me in that order', () => {
    expect(POST_PRIVACY_OPTIONS.map((option) => `${option.emoji} ${option.label}`)).toEqual([
      '🌎 Public',
      '👥 Friends',
      '⚙️ Custom',
      '🔒 Only Me',
    ]);
  });

  test('PUBLIC is visible to everyone who is not blocked', () => {
    expect(canViewPost(post({}), stranger)).toBe(true);
    expect(canViewPost(post({}), viewer('blocked', { blockedIds: new Set([AUTHOR.id]) }))).toBe(false);
  });

  test('FRIENDS is visible only to accepted friends', () => {
    const friendsPost = post({ visibility: 'FRIENDS' });

    expect(canViewPost(friendsPost, friend)).toBe(true);
    expect(canViewPost(friendsPost, stranger)).toBe(false);
    expect(canViewPost(friendsPost, author)).toBe(true);
  });

  test('CUSTOM is visible only to the chosen people, not to every friend', () => {
    const customPost = post({ visibility: 'CUSTOM', customViewerIds: ['chosen'] });

    expect(canViewPost(customPost, chosen)).toBe(true);
    expect(canViewPost(customPost, friend)).toBe(false);
    expect(canViewPost(customPost, stranger)).toBe(false);
    expect(canViewPost(customPost, author)).toBe(true);
  });

  test('ONLY_ME is visible only to the author', () => {
    const privatePost = post({ visibility: 'ONLY_ME' });

    expect(canViewPost(privatePost, author)).toBe(true);
    expect(canViewPost(privatePost, friend)).toBe(false);
    expect(canViewPost(privatePost, chosen)).toBe(false);
  });

  test('the audience follows the server rules', () => {
    expect(validatePostAudience('CUSTOM', [], 'me')).toMatch(/at least one/);
    expect(validatePostAudience('CUSTOM', ['me'], 'me')).toMatch(/yourself/);
    expect(validatePostAudience('PUBLIC', ['someone'], 'me')).toMatch(/only be chosen/);
    expect(validatePostAudience('CUSTOM', ['someone'], 'me')).toBeNull();
    expect(validatePostAudience('ONLY_ME', [], 'me')).toBeNull();

    const draft = {
      body: 'Hi',
      sport: 'Running',
      photoUrls: [],
      taggedUserIds: [],
      location: null,
      visibility: 'CUSTOM' as const,
    };
    expect(canPublishPost({ ...draft, customViewerIds: [] }, 'me')).toBe(false);
    expect(canPublishPost({ ...draft, customViewerIds: ['someone'] }, 'me')).toBe(true);
  });
});

describe('visibility-filtered feeds (mock data as the server would send it)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('the viewer never receives other people’s ONLY_ME, unchosen CUSTOM, or non-friend FRIENDS posts', async () => {
    const store = usePostsStore();
    await store.load();
    const ids = store.visiblePosts.map((candidate) => candidate.id);

    expect(ids).toEqual(expect.arrayContaining(['feed-post-5', 'feed-post-7', 'post-5', 'post-6']));
    expect(ids).not.toContain('feed-post-6');
    expect(ids).not.toContain('feed-post-8');
    expect(store.byAuthor(mockUsers.paolo.id).every((candidate) => candidate.visibility === 'PUBLIC')).toBe(true);
    expect(store.byAuthor(mockUsers.carlo.id)).toEqual([]);
  });

  test('changing privacy takes effect immediately and only the author may do it', async () => {
    const store = usePostsStore();
    await store.load();

    expect(await store.updateVisibility('feed-post-1', 'ONLY_ME', [])).toMatch(/Only the author/);
    expect(await store.updateVisibility('post-1', 'CUSTOM', [])).toMatch(/at least one/);

    expect(await store.updateVisibility('post-1', 'CUSTOM', [mockUsers.john.id])).toBeNull();
    expect(store.posts.find((candidate) => candidate.id === 'post-1')).toMatchObject({
      visibility: 'CUSTOM',
      customViewerIds: [mockUsers.john.id],
    });

    expect(await store.updateVisibility('post-1', 'PUBLIC', [])).toBeNull();
    expect(store.posts.find((candidate) => candidate.id === 'post-1')?.customViewerIds).toBeUndefined();
  });

  test('a blocked author disappears from every feed', async () => {
    const store = usePostsStore();
    await store.load();
    useFriendsStore().blockedIds = [mockUsers.john.id];

    expect(store.visiblePosts.some((candidate) => candidate.author.id === mockUsers.john.id)).toBe(false);
  });

  test('the card shows a privacy indicator but never the custom viewer list', async () => {
    const session = useSessionStore();
    await session.load();
    const customPost = buildMockPosts(NOW).find((candidate) => candidate.id === 'post-5')!;

    const wrapper = mount(PostCard, {
      props: { post: customPost, nowMs: NOW },
      global: {
        provide: { [routerKey as symbol]: { replace: () => undefined, push: () => undefined } },
        stubs: { RouterLink: { template: '<a><slot /></a>' }, EditPostPrivacyModal: true, TagPeopleModal: true },
      },
    });

    expect(wrapper.find('[aria-label="Visible to: Custom"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Post options"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain(mockUsers.john.displayName);
  });
});

describe('relationship-driven profile actions', () => {
  const none = { friendIds: new Set<string>(), blockedIds: new Set<string>(), requestDirection: null };

  test('each state has its own buttons', () => {
    expect(profileActionsFor(resolveRelationship('me', 'them', none))).toEqual(['ADD_FRIEND', 'MESSAGE']);
    expect(profileActionsFor(resolveRelationship('me', 'them', { ...none, requestDirection: 'SENT' }))).toEqual([
      'REQUEST_SENT',
      'MESSAGE',
    ]);
    expect(profileActionsFor(resolveRelationship('me', 'them', { ...none, requestDirection: 'RECEIVED' }))).toEqual([
      'ACCEPT',
      'DELETE',
    ]);
    expect(profileActionsFor(resolveRelationship('me', 'them', { ...none, friendIds: new Set(['them']) }))).toEqual([
      'FRIENDS',
      'MESSAGE',
    ]);
    expect(profileActionsFor(resolveRelationship('me', 'them', { ...none, blockedIds: new Set(['them']) }))).toEqual([
      'UNBLOCK',
    ]);
    expect(profileActionsFor(resolveRelationship('me', 'me', none))).toEqual([]);
  });

  test('friends message directly, others send a request, blocked users cannot message', () => {
    expect(messageAccessFor('FRIENDS')).toBe('DIRECT');
    expect(messageAccessFor('NO_RELATIONSHIP')).toBe('REQUEST');
    expect(messageAccessFor('BLOCKED')).toBe('NONE');
    expect(messageAccessFor('SELF')).toBe('NONE');
  });

  test('your own name links to your Profile tab, others to their profile', () => {
    expect(userProfilePath('louis', 'louis')).toBe('/profile');
    expect(userProfilePath('maria', 'louis')).toBe('/profile/maria');
  });
});

describe('friend requests and message requests from a profile', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('you cannot add yourself, and a pair has at most one friend request', async () => {
    const friends = useFriendsStore();
    await friends.load();
    const alex = { ...mockUsers.alex, primarySport: 'Football', city: 'Taguig', distanceKm: 1, followers: 1, gamesCompleted: 1, featured: false };
    const self = { ...alex, ...mockCurrentUser };

    expect(await friends.sendRequest(mockCurrentUser.id, self, NOW)).toBe(false);
    expect(friends.relationshipWith(mockCurrentUser.id, mockUsers.alex.id)).toBe('FRIENDS');

    const sam = { ...alex, ...mockUsers.sam };
    friends.friends = friends.friends.filter((friend) => friend.id !== sam.id);
    expect(await friends.sendRequest(mockCurrentUser.id, sam, NOW)).toBe(true);
    expect(friends.relationshipWith(mockCurrentUser.id, sam.id)).toBe('REQUEST_SENT');
    expect(await friends.sendRequest(mockCurrentUser.id, sam, NOW)).toBe(false);

    expect(friends.relationshipWith(mockCurrentUser.id, mockUsers.bea.id)).toBe('REQUEST_RECEIVED');
    friends.accept(friends.requestWith(mockUsers.bea.id)!.id);
    expect(friends.relationshipWith(mockCurrentUser.id, mockUsers.bea.id)).toBe('FRIENDS');
  });

  test('friends open a direct chat; others get one message request per pair', async () => {
    const chat = useChatStore();
    await chat.load();

    const existing = chat.findDirectWith(mockUsers.john.id)!;
    expect(await chat.openDirect(mockUsers.john, NOW)).toBe(existing.id);
    const started = await chat.openDirect(mockUsers.sam, NOW);
    expect(chat.getConversation(started ?? '')?.partner.id).toBe(mockUsers.sam.id);

    expect(await chat.sendMessageRequest(mockUsers.bea, '   ', NOW)).toBe('EMPTY');
    expect(await chat.sendMessageRequest(mockUsers.bea, 'Hi Bea!', NOW)).toBe('SENT');
    expect(await chat.sendMessageRequest(mockUsers.bea, 'Hi again', NOW)).toBe('ALREADY_SENT');
    expect(chat.outgoingRequests).toHaveLength(1);
    expect(await chat.sendMessageRequest(mockUsers.paolo, 'Hello', NOW)).toBe('THEY_ALREADY_ASKED');
  });

  test('messaging a non-friend opens the chat screen; the first message becomes the request', async () => {
    const chat = useChatStore();
    await chat.load();

    expect(chat.openRequest(mockUsers.bea)).toBe(`/chat/request/${mockUsers.bea.id}`);
    expect(chat.requestRecipient(mockUsers.bea.id)?.id).toBe(mockUsers.bea.id);
    expect(chat.outgoingRequestTo(mockUsers.bea.id)).toBeUndefined();
    expect(chat.requestRecipient('someone-never-opened')).toBeUndefined();

    expect(await chat.sendMessageRequest(mockUsers.bea, 'Want to play Saturday?', NOW)).toBe('SENT');
    expect(chat.outgoingRequestTo(mockUsers.bea.id)?.initialMessage).toBe('Want to play Saturday?');
    expect(await chat.sendMessageRequest(mockUsers.bea, 'Hello?', NOW)).toBe('ALREADY_SENT');
    expect(chat.conversations.some((conversation) => conversation.partner.id === mockUsers.bea.id)).toBe(false);
  });
});

describe('Profile → My Feed', () => {
  const account = {
    id: '6f1c2b9e-0000-4000-8000-000000000001',
    username: 'banana',
    email: 'banana@example.com',
    firstName: 'Bana',
    lastName: 'Na',
    role: 'USER' as const,
    profileImageUrl: null,
    bio: null,
    city: null,
  };

  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('shows only posts written by the signed-in account, never other people’s', async () => {
    const auth = useAuthStore();
    auth.currentUser = account;
    const posts = usePostsStore();
    await posts.load();

    expect(posts.visiblePosts.some((candidate) => candidate.author.id !== account.id)).toBe(true);
    expect(posts.myPosts).toEqual([]);

    const draft = {
      body: 'My first game on GORA',
      sport: 'Volleyball',
      visibility: 'ONLY_ME' as const,
      customViewerIds: [],
      taggedUserIds: [],
      location: null,
      photoUrls: [],
    };
    const published = await posts.publish(posts.me!, draft);

    expect(published?.author).toMatchObject({ id: account.id, username: 'banana' });
    expect(posts.myPosts.map((candidate) => candidate.id)).toEqual([published!.id]);
    expect(posts.visiblePosts.some((candidate) => candidate.id === published!.id)).toBe(true);
    expect(await posts.updateVisibility(published!.id, 'PUBLIC', [])).toBeNull();
    expect(await posts.updateVisibility(posts.posts.find((p) => p.author.id === mockCurrentUser.id)!.id, 'PUBLIC', []))
      .toBe('Only the author can change who can see this post.');
  });
});
