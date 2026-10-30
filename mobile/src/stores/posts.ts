import { defineStore } from 'pinia';
import { ApiError } from '@/services/api-client';
import { computed, ref, watch } from 'vue';
import { fetchPosts, publishPost, updatePostTags, updatePostVisibility } from '@/services/post.service';
import {
  createPost as createPostRequest,
  getPost,
  recordPostShare,
  deletePost as deletePostRequest,
  listFeed,
  listSavedPosts,
  listArchivedPosts,
  listUserPosts,
  setPostFeedback,
  setPostLike,
  setPostSaved,
  setPostArchived,
  updatePost as updatePostRequest,
  updatePostTags as updatePostTagsRequest,
  updatePostVisibility as updatePostVisibilityRequest,
} from '@/services/posts-api.service';
import type { ApiPost, FeedPost, PostDraft, PostEdit, PostVisibility, UpdatePostInput } from '@/types/post';
import type { UserSummary } from '@/types/user';
import { canPublishPost } from '@/utils/feed';
import { isServerId, toFeedPost, validatePostEdit } from '@/utils/post-api';
import { validatePostTags } from '@/utils/post-details';
import { canViewPost, validatePostAudience } from '@/utils/post-privacy';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';
import { useFriendsStore } from './friends';
import type { LoadStatus } from './sports';
import { useSportsStore } from './sports';
import { useSessionStore } from './session';
import { preparePostPhoto } from '@/utils/post-photos';

export const POST_UNAVAILABLE_MESSAGE = 'This post is no longer available.';
export const DEMO_PEOPLE_MESSAGE = 'Saved posts can only tag or include GORA accounts.';

/** The server writes its 403 messages for people ("Only the author can edit this post."). */
const describePostError = (caught: unknown): string => describeContentError(caught, POST_UNAVAILABLE_MESSAGE);

function sameLocation(a: PostEdit['location'], b: FeedPost['location']): boolean {
  return (
    (a?.name ?? null) === (b?.name ?? null) &&
    (a?.latitude ?? null) === (b?.latitude ?? null) &&
    (a?.longitude ?? null) === (b?.longitude ?? null)
  );
}

/**
 * One list for everyone's posts, so a post shows on Home, Profile, and Search at once.
 * When signed in, posts are stored in PostgreSQL through the posts API (`serverPosts`,
 * already filtered for privacy by the server). Demo posts appear only when signed out.
 * The Friends feed is queried separately so other public posts cannot crowd it out.
 */
export const usePostsStore = defineStore('posts', () => {
  const auth = useAuthStore();
  const session = useSessionStore();
  const friendsStore = useFriendsStore();
  const sportsStore = useSportsStore();

  const posts = ref<FeedPost[]>([]);
  const isLoaded = ref(false);
  const serverPosts = ref<FeedPost[]>([]);
  const savedPosts = ref<FeedPost[]>([]);
  const archivedPosts = ref<FeedPost[]>([]);
  const serverStatus = ref<LoadStatus>('idle');
  const serverError = ref<string | null>(null);
  const loadedForUserId = ref<string | null>(null);
  const publishError = ref<string | null>(null);
  const busyPostId = ref<string | null>(null);
  const friendPosts = ref<FeedPost[]>([]);
  const profilePosts = ref<Record<string, FeedPost>>({});
  const likingPostIds = ref(new Set<string>());
  const nextCursor = ref<string | null>(null);
  const friendsNextCursor = ref<string | null>(null);
  const loadingMore = ref(false);
  let refreshAgain = false;
  let feedGeneration = 0;

  /** Who writes new posts: the signed-in account (the demo user only when nobody is signed in). */
  const me = computed<UserSummary | null>(() => session.me);
  /** Posts written by the signed-in account, newest first (Profile → My Feed). */
  const myPosts = computed(() => (me.value ? byAuthor(me.value.id) : []));
  /** New posts go to the database whenever there is a session token. */
  const savesToServer = computed(() => auth.accessToken !== null);

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      feedGeneration++;
      serverPosts.value = [];
      savedPosts.value = [];
      serverStatus.value = 'idle';
      serverError.value = null;
      loadedForUserId.value = null;
      friendPosts.value = [];
      profilePosts.value = {};
      likingPostIds.value = new Set();
      busyPostId.value = null;
      loadingMore.value = false;
      publishError.value = null;
      refreshAgain = false;
      nextCursor.value = null;
      friendsNextCursor.value = null;
    },
    { flush: 'sync' },
  );

  watch(
    () => friendsStore.revision,
    () => {
      feedGeneration++;
      friendPosts.value = [];
      profilePosts.value = {};
      loadingMore.value = false;
      if (savesToServer.value && isLoaded.value) {
        serverPosts.value = [];
        void refresh();
      }
    },
  );

  /**
   * The posts the current viewer may see. Real posts were already filtered by the server;
   * the client mirror only keeps the demo data honest (no ONLY_ME, FRIENDS, or CUSTOM leaks).
   * Authors always see their own posts.
   */
  const visiblePosts = computed(() => {
    const viewer = session.currentUser;
    const myId = me.value?.id;

    if (!viewer) {
      return serverPosts.value;
    }

    if (savesToServer.value) return serverPosts.value;

    const demo = posts.value.filter(
      (post) =>
        post.author.id === myId ||
        canViewPost(post, { id: viewer.id, friendIds: friendsStore.friendIds, blockedIds: friendsStore.blockedIdSet }),
    );

    return [...serverPosts.value, ...demo];
  });

  const authorized = createAuthorizedCall(auth);

  async function load(): Promise<void> {
    if (!isLoaded.value) {
      [posts.value] = await Promise.all([fetchPosts(), session.load(), friendsStore.load()]);
      isLoaded.value = true;
    }

    if (savesToServer.value && loadedForUserId.value !== (auth.currentUser?.id ?? null)) {
      await refresh();
    }
  }

  /** Reloads the real posts: the Home feed plus the account's own posts (for My Feed). */
  async function refresh(): Promise<void> {
    if (!savesToServer.value) return;
    if (serverStatus.value === 'loading') {
      refreshAgain = true;
      return;
    }

    const userId = auth.currentUser?.id ?? null;
    const version = ++feedGeneration;
    loadingMore.value = false;
    const username = auth.currentUser?.username;
    serverStatus.value = 'loading';
    serverError.value = null;

    try {
      const [feed, circle] = await Promise.all([
        authorized((token) => listFeed(token)),
        authorized((token) => listFeed(token, 'FRIENDS')),
      ]);
      const own = username ? await authorized((token) => listUserPosts(token, username)) : { posts: [] };
      if (userId !== (auth.currentUser?.id ?? null) || version !== feedGeneration) return;
      const byId = new Map<string, ApiPost>();

      for (const post of [...feed.posts, ...own.posts]) {
        byId.set(post.id, post);
      }

      serverPosts.value = [...byId.values()]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(toFeedPost);
      serverStatus.value = 'ready';
      loadedForUserId.value = userId;
      friendPosts.value = circle.posts.map(toFeedPost);
      nextCursor.value = feed.nextCursor;
      friendsNextCursor.value = circle.nextCursor;
    } catch (caught) {
      if (userId !== (auth.currentUser?.id ?? null) || version !== feedGeneration) return;
      serverStatus.value = 'error';
      serverError.value = describePostError(caught);
    } finally {
      if (refreshAgain && userId === (auth.currentUser?.id ?? null)) {
        refreshAgain = false;
        serverStatus.value = 'idle';
        void refresh();
      }
    }
  }

  async function loadMore(scope: 'ALL' | 'FRIENDS'): Promise<void> {
    const cursor = scope === 'ALL' ? nextCursor.value : friendsNextCursor.value;
    if (!cursor || loadingMore.value || serverStatus.value === 'loading') return;
    const userId = auth.currentUser?.id;
    const version = feedGeneration;
    loadingMore.value = true;
    try {
      const page = await authorized((token) => listFeed(token, scope, cursor));
      if (userId !== auth.currentUser?.id || version !== feedGeneration) return;
      const target = scope === 'ALL' ? serverPosts : friendPosts;
      target.value = [
        ...new Map([...target.value, ...page.posts.map(toFeedPost)].map((post) => [post.id, post])).values(),
      ];
      if (scope === 'ALL') nextCursor.value = page.nextCursor;
      else friendsNextCursor.value = page.nextCursor;
    } catch (caught) {
      if (userId === auth.currentUser?.id && version === feedGeneration) serverError.value = describePostError(caught);
    } finally {
      if (userId === auth.currentUser?.id && version === feedGeneration) loadingMore.value = false;
    }
  }

  function findPost(postId: string): FeedPost | undefined {
    return (
      serverPosts.value.find((post) => post.id === postId) ??
      friendPosts.value.find((post) => post.id === postId) ??
      profilePosts.value[postId] ??
      posts.value.find((post) => post.id === postId)
    );
  }

  function replacePost(updated: FeedPost): void {
    if (updated.fromServer) {
      if (profilePosts.value[updated.id]) profilePosts.value[updated.id] = updated;
      serverPosts.value = serverPosts.value.map((post) => (post.id === updated.id ? updated : post));
      friendPosts.value = friendPosts.value.map((post) => (post.id === updated.id ? updated : post));
    } else {
      posts.value = posts.value.map((post) => (post.id === updated.id ? updated : post));
    }
  }

  /** Profile pages share reactions and edits without adding profile results to the Home feed. */
  function rememberProfilePosts(items: FeedPost[]): void {
    for (const item of items) {
      profilePosts.value[item.id] = item;
      replacePost(item);
    }
  }

  /** An author's posts that the viewer may see, newest first (profile feeds). */
  function byAuthor(userId: string): FeedPost[] {
    return visiblePosts.value
      .filter((post) => post.author.id === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async function sportIdFor(name: string): Promise<string | null> {
    await sportsStore.fetchSports();
    return sportsStore.activeSports.find((sport) => sport.name === name)?.id ?? null;
  }

  async function publish(author: UserSummary, draft: PostDraft, files: File[] = []): Promise<FeedPost | null> {
    const isCurrent = captureSession(auth);
    publishError.value = null;

    if (!canPublishPost(draft, author.id)) {
      return null;
    }

    if (!savesToServer.value) {
      const post = await publishPost(author, draft);
      posts.value = [post, ...posts.value];
      return post;
    }

    if (draft.photoUrls.length !== files.length) {
      publishError.value = 'Choose your photos again before posting.';
      return null;
    }

    const people = [...draft.taggedUserIds, ...(draft.visibility === 'CUSTOM' ? draft.customViewerIds : [])];

    if (!people.every(isServerId)) {
      publishError.value = DEMO_PEOPLE_MESSAGE;
      return null;
    }

    try {
      const photos: string[] = [];
      // Sequential preparation bounds memory on phones.
      for (const file of files) {
        photos.push(await preparePostPhoto(file));
        if (!isCurrent()) return null;
      }
      const sportId = await sportIdFor(draft.sport);
      if (!isCurrent()) return null;
      const created = await authorized((token) =>
        createPostRequest(token, {
          caption: draft.body.trim(),
          ...(photos.length ? { photos } : {}),
          visibility: draft.visibility,
          ...(sportId ? { sportId } : {}),
          ...(draft.visibility === 'CUSTOM' ? { customViewerIds: draft.customViewerIds } : {}),
          ...(draft.taggedUserIds.length > 0 ? { taggedUserIds: draft.taggedUserIds } : {}),
          ...(draft.location ? { location: { ...draft.location, name: draft.location.name.trim() } } : {}),
        }),
      );
      const post = toFeedPost(created);
      serverPosts.value = [post, ...serverPosts.value];
      friendPosts.value = [post, ...friendPosts.value];
      return post;
    } catch (caught) {
      if (isCurrent())
        publishError.value =
          caught instanceof Error && !(caught instanceof ApiError) ? caught.message : describePostError(caught);
      return null;
    }
  }

  async function loadPost(postId: string): Promise<FeedPost> {
    const result = toFeedPost(await authorized((token) => getPost(token, postId)));
    rememberProfilePosts([result]);
    return result;
  }

  async function share(postId: string): Promise<string | null> {
    try {
      replacePost(toFeedPost(await authorized((token) => recordPostShare(token, postId))));
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  /** Edit Post (author only): caption, sport, and location. Returns an error message or null. */
  async function editPost(postId: string, edit: PostEdit): Promise<string | null> {
    const isCurrent = captureSession(auth);
    const post = findPost(postId);

    if (!post || post.author.id !== me.value?.id) {
      return 'Only the author can edit this post.';
    }

    const error = validatePostEdit(edit, post.media.length > 0);

    if (error) {
      return error;
    }

    if (busyPostId.value) {
      return null;
    }

    const caption = edit.body.trim();
    const location = edit.location ? { ...edit.location, name: edit.location.name.trim() } : null;

    if (!post.fromServer) {
      replacePost({ ...post, body: caption, sport: edit.sport, location, editedAt: new Date().toISOString() });
      return null;
    }

    busyPostId.value = postId;

    try {
      const changes: UpdatePostInput = {};

      if (caption !== post.body) {
        changes.caption = caption;
      }

      if (edit.sport !== post.sport) {
        changes.sportId = await sportIdFor(edit.sport);
      }

      if (!sameLocation(location, post.location)) {
        changes.location = location;
      }

      if (!isCurrent()) return 'The account changed. Try again.';
      const updated = await authorized((token) => updatePostRequest(token, postId, changes));
      replacePost(toFeedPost(updated));
      return null;
    } catch (caught) {
      return describePostError(caught);
    } finally {
      if (isCurrent()) busyPostId.value = null;
    }
  }

  /** Delete Post (author only). The server keeps the row (soft delete) but nobody sees it again. */
  async function deletePost(postId: string): Promise<string | null> {
    const isCurrent = captureSession(auth);
    const post = findPost(postId);

    if (!post || post.author.id !== me.value?.id) {
      return 'Only the author can delete this post.';
    }

    if (busyPostId.value) {
      return null;
    }

    if (post.fromServer) {
      busyPostId.value = postId;

      try {
        await authorized((token) => deletePostRequest(token, postId));
      } catch (caught) {
        return describePostError(caught);
      } finally {
        if (isCurrent()) busyPostId.value = null;
      }
    }

    serverPosts.value = serverPosts.value.filter((candidate) => candidate.id !== postId);
    friendPosts.value = friendPosts.value.filter((candidate) => candidate.id !== postId);
    delete profilePosts.value[postId];
    posts.value = posts.value.filter((candidate) => candidate.id !== postId);
    return null;
  }

  /** Author only; the new audience applies immediately. Returns an error message or null. */
  async function updateVisibility(
    postId: string,
    visibility: PostVisibility,
    customViewerIds: string[],
  ): Promise<string | null> {
    const post = findPost(postId);
    const viewerId = me.value?.id;

    if (!post || post.author.id !== viewerId) {
      return 'Only the author can change who can see this post.';
    }

    const error = validatePostAudience(visibility, customViewerIds, viewerId);

    if (error) {
      return error;
    }

    if (!post.fromServer) {
      replacePost(await updatePostVisibility(post, visibility, customViewerIds));
      return null;
    }

    if (visibility === 'CUSTOM' && !customViewerIds.every(isServerId)) {
      return DEMO_PEOPLE_MESSAGE;
    }

    try {
      const updated = await authorized((token) =>
        updatePostVisibilityRequest(token, postId, visibility, customViewerIds),
      );
      replacePost(toFeedPost(updated));
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  /** Author only; the list replaces the current tags ([] removes them all). Returns an error message or null. */
  async function updateTags(postId: string, taggedUserIds: string[]): Promise<string | null> {
    const post = findPost(postId);
    const viewerId = me.value?.id;

    if (!post || post.author.id !== viewerId) {
      return 'Only the author can change who is tagged.';
    }

    const error = validatePostTags(taggedUserIds, viewerId);

    if (error) {
      return error;
    }

    if (!post.fromServer) {
      replacePost(await updatePostTags(post, taggedUserIds));
      return null;
    }

    if (!taggedUserIds.every(isServerId)) {
      return DEMO_PEOPLE_MESSAGE;
    }

    try {
      const updated = await authorized((token) => updatePostTagsRequest(token, postId, taggedUserIds));
      replacePost(toFeedPost(updated));
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  async function toggleLike(postId: string): Promise<string | null> {
    const post = findPost(postId);

    if (!post) {
      return null;
    }

    const likedByViewer = !post.likedByViewer;
    if (!post.fromServer) {
      replacePost({ ...post, likedByViewer, likes: Math.max(0, post.likes + (likedByViewer ? 1 : -1)) });
      return null;
    }
    if (likingPostIds.value.has(postId)) return null;
    const pending = likingPostIds.value;
    pending.add(postId);
    try {
      const updated = await authorized((token) => setPostLike(token, postId, likedByViewer));
      replacePost(toFeedPost(updated));
      return null;
    } catch (caught) {
      return describePostError(caught);
    } finally {
      pending.delete(postId);
    }
  }

  async function setFeedback(postId: string, feedback: 'INTERESTED' | 'NOT_INTERESTED' | null): Promise<string | null> {
    const post = findPost(postId);
    if (!post) return 'This post is no longer available.';
    if (!post.fromServer) return 'Sign in to save your post preferences.';
    try {
      const updated = toFeedPost(await authorized((token) => setPostFeedback(token, postId, feedback)));
      replacePost(updated);
      savedPosts.value = savedPosts.value.map((item) => (item.id === postId ? updated : item));
      if (feedback === 'NOT_INTERESTED') {
        serverPosts.value = serverPosts.value.filter((item) => item.id !== postId);
        friendPosts.value = friendPosts.value.filter((item) => item.id !== postId);
      }
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  async function setSaved(postId: string, saved: boolean): Promise<string | null> {
    const post = findPost(postId);
    if (!post) return 'This post is no longer available.';
    if (!post.fromServer) return 'Sign in to save posts to your account.';
    try {
      const updated = toFeedPost(await authorized((token) => setPostSaved(token, postId, saved)));
      replacePost(updated);
      savedPosts.value = saved
        ? [updated, ...savedPosts.value.filter((item) => item.id !== postId)]
        : savedPosts.value.filter((item) => item.id !== postId);
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  async function loadSaved(): Promise<string | null> {
    if (!auth.accessToken) return 'Sign in to view your saved posts.';
    try {
      const page = await authorized((token) => listSavedPosts(token));
      savedPosts.value = page.posts.map(toFeedPost);
      rememberProfilePosts(savedPosts.value);
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  async function loadArchived(): Promise<string | null> {
    if (!auth.accessToken) return 'Sign in to view archived posts.';
    try {
      const page = await authorized((token) => listArchivedPosts(token));
      archivedPosts.value = page.posts.map(toFeedPost);
      rememberProfilePosts(archivedPosts.value);
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  async function setArchived(postId: string, archived: boolean): Promise<string | null> {
    const post = findPost(postId);
    if (!post || post.author.id !== me.value?.id) return 'Only the author can archive this post.';
    if (!post.fromServer) return 'Sign in to archive posts.';
    try {
      const updated = toFeedPost(await authorized((token) => setPostArchived(token, postId, archived)));
      replacePost(updated);
      archivedPosts.value = archived
        ? [updated, ...archivedPosts.value.filter((item) => item.id !== postId)]
        : archivedPosts.value.filter((item) => item.id !== postId);
      if (archived) {
        serverPosts.value = serverPosts.value.filter((item) => item.id !== postId);
        friendPosts.value = friendPosts.value.filter((item) => item.id !== postId);
        savedPosts.value = savedPosts.value.filter((item) => item.id !== postId);
      } else {
        serverPosts.value = [updated, ...serverPosts.value.filter((item) => item.id !== postId)];
        if (updated.savedByViewer) savedPosts.value = [updated, ...savedPosts.value.filter((item) => item.id !== postId)];
      }
      return null;
    } catch (caught) {
      return describePostError(caught);
    }
  }

  return {
    posts,
    serverPosts,
    savedPosts,
    archivedPosts,
    friendPosts,
    nextCursor,
    friendsNextCursor,
    loadingMore,
    loadMore,
    serverStatus,
    serverError,
    visiblePosts,
    me,
    myPosts,
    isLoaded,
    savesToServer,
    publishError,
    busyPostId,
    load,
    loadSaved,
    loadArchived,
    refresh,
    byAuthor,
    publish,
    editPost,
    deletePost,
    updateVisibility,
    updateTags,
    toggleLike,
    setFeedback,
    setSaved,
    setArchived,
    findPost,
    rememberProfilePosts,
    loadPost,
    share,
  };
});
