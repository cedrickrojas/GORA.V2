import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { fetchStories } from '@/services/story.service';
import {
  createStory as createStoryRequest,
  deleteStory as deleteStoryRequest,
  listActiveStories,
  listMyStories,
  updateStory as updateStoryRequest,
  updateStoryVisibility as updateStoryVisibilityRequest,
  uploadStory as uploadStoryRequest,
} from '@/services/stories-api.service';
import type { MediaUploadOptions } from '@/services/media-upload.service';
import type { PostVisibility } from '@/types/post';
import type { ApiStory, Story, StoryDraft, StoryGroup, StoryUploadDraft } from '@/types/story';
import { storyFileType, validateStoryFile } from '@/utils/story-upload';
import { STORY_CAPTION_MAX_LENGTH, toStory, validateCaption, validateStoryDraft } from '@/utils/media-api';
import { isServerId } from '@/utils/post-api';
import { validatePostAudience } from '@/utils/post-privacy';
import { groupStoriesByUser, partitionStories } from '@/utils/stories';
import { useAuthStore } from './auth';
import { captureSession, createAuthorizedCall, describeContentError } from './authorized';
import { DEMO_PEOPLE_MESSAGE } from './posts';
import { useSessionStore } from './session';
import { useFriendsStore } from './friends';
import type { LoadStatus } from './sports';

export const STORY_UNAVAILABLE_MESSAGE = 'This story is no longer available.';
export const STORY_SIGN_IN_MESSAGE = 'Log in to add a story.';

/**
 * Stories for the rail, the viewer, and My Stories. When signed in, stories are stored in
 * PostgreSQL (`serverStories` are already filtered for privacy by the server, `myServerStories`
 * include your expired ones). Sample stories are used only when signed out.
 */
export const useStoriesStore = defineStore('stories', () => {
  const auth = useAuthStore();
  const session = useSessionStore();
  const authorized = createAuthorizedCall(auth);
  const friendsStore = useFriendsStore();
  let generation = 0;

  const stories = ref<Story[]>([]);
  const isLoaded = ref(false);
  const serverStories = ref<Story[]>([]);
  const myServerStories = ref<Story[]>([]);
  const serverStatus = ref<LoadStatus>('idle');
  const serverError = ref<string | null>(null);
  const loadedForUserId = ref<string | null>(null);
  const busyStoryId = ref<string | null>(null);

  /** The signed-in account (the demo user only when nobody is signed in). */
  const viewer = computed(() => session.me);
  const savesToServer = computed(() => auth.accessToken !== null);

  const allStories = computed(() => (savesToServer.value ? serverStories.value : stories.value));

  /** Your stories, active and expired (My Stories). Only the signed-in account's own. */
  const myStories = computed(() =>
    savesToServer.value ? myServerStories.value : stories.value.filter((story) => story.user.id === viewer.value?.id),
  );

  watch(
    [() => auth.sessionVersion, () => auth.accessToken, () => auth.currentUser?.id],
    () => {
      generation++;
      serverStories.value = [];
      myServerStories.value = [];
      serverStatus.value = 'idle';
      loadedForUserId.value = null;
      serverError.value = null;
      busyStoryId.value = null;
    },
    { flush: 'sync' },
  );

  watch(
    () => friendsStore.revision,
    () => {
      generation++;
      serverStories.value = [];
      serverStatus.value = 'idle';
      loadedForUserId.value = null;
      if (savesToServer.value && isLoaded.value) void refresh();
    },
  );

  async function load(): Promise<void> {
    if (!isLoaded.value) {
      [stories.value] = await Promise.all([fetchStories(), session.load()]);
      isLoaded.value = true;
    }

    if (savesToServer.value && loadedForUserId.value !== (auth.currentUser?.id ?? null)) {
      await refresh();
    }
  }

  async function refresh(): Promise<void> {
    if (!savesToServer.value || serverStatus.value === 'loading') {
      return;
    }

    const userId = auth.currentUser?.id ?? null;
    const isCurrent = captureSession(auth);
    const version = generation;
    serverStatus.value = 'loading';
    serverError.value = null;

    try {
      const [active, mine] = await authorized((token) => Promise.all([listActiveStories(token), listMyStories(token)]));
      if (version !== generation) return;
      serverStories.value = active.map(toStory);
      myServerStories.value = mine.map(toStory);
      serverStatus.value = 'ready';
      loadedForUserId.value = userId;
    } catch (caught) {
      if (!isCurrent() || version !== generation) return;
      serverStatus.value = 'error';
      serverError.value = describeContentError(caught, STORY_UNAVAILABLE_MESSAGE);
    }
  }

  function getFeedAt(nowMs: number): {
    own: StoryGroup | null;
    others: StoryGroup[];
  } {
    const { active } = partitionStories(allStories.value, nowMs);
    const groups = groupStoriesByUser(active);
    const viewerId = viewer.value?.id;

    return {
      own: groups.find((group) => group.user.id === viewerId) ?? null,
      others: groups.filter((group) => group.user.id !== viewerId),
    };
  }

  function findOwnStory(storyId: string): Story | undefined {
    const story =
      myServerStories.value.find((candidate) => candidate.id === storyId) ??
      serverStories.value.find((candidate) => candidate.id === storyId);

    return story && story.fromServer && story.user.id === viewer.value?.id ? story : undefined;
  }

  /** Updated in place, so an open story viewer (which holds these objects) shows the change. */
  function replaceStory(updated: ApiStory): void {
    for (const list of [serverStories.value, myServerStories.value]) {
      const existing = list.find((candidate) => candidate.id === updated.id);

      if (existing) {
        Object.assign(existing, toStory(updated));
      }
    }
  }

  /** Add Story. Returns the new story, or an error message. */
  async function createStory(draft: StoryDraft): Promise<{ story: Story } | { error: string }> {
    if (!savesToServer.value) {
      return { error: STORY_SIGN_IN_MESSAGE };
    }

    const error = validateStoryDraft(draft, viewer.value?.id ?? null);

    if (error) {
      return { error };
    }

    if (draft.visibility === 'CUSTOM' && !draft.customViewerIds.every(isServerId)) {
      return { error: DEMO_PEOPLE_MESSAGE };
    }

    const caption = draft.caption.trim();

    try {
      const created = await authorized((token) =>
        createStoryRequest(token, {
          mediaType: draft.mediaType,
          mediaUrl: draft.mediaUrl.trim(),
          visibility: draft.visibility,
          ...(caption ? { caption } : {}),
          ...(draft.visibility === 'CUSTOM' ? { customViewerIds: draft.customViewerIds } : {}),
        }),
      );
      const story = toStory(created);
      serverStories.value = [...serverStories.value, story];
      myServerStories.value = [story, ...myServerStories.value];
      return { story };
    } catch (caught) {
      return { error: describeContentError(caught, STORY_UNAVAILABLE_MESSAGE) };
    }
  }

  async function uploadStory(
    draft: StoryUploadDraft,
    options: MediaUploadOptions = {},
  ): Promise<{ story: Story } | { error: string }> {
    const isCurrent = captureSession(auth);
    if (!savesToServer.value) return { error: STORY_SIGN_IN_MESSAGE };
    const error =
      validateStoryFile(draft.media) ??
      validateCaption(draft.caption, STORY_CAPTION_MAX_LENGTH) ??
      validatePostAudience(draft.visibility, draft.customViewerIds, auth.currentUser?.id ?? null, 'story');
    if (error) return { error };
    if (draft.visibility === 'CUSTOM' && !draft.customViewerIds.every(isServerId))
      return { error: DEMO_PEOPLE_MESSAGE };
    try {
      const created = await authorized((token) =>
        uploadStoryRequest(
          token,
          draft.media,
          {
            mediaType: storyFileType(draft.media)!,
            visibility: draft.visibility,
            ...(draft.caption.trim() ? { caption: draft.caption.trim() } : {}),
            ...(draft.visibility === 'CUSTOM' ? { customViewerIds: draft.customViewerIds } : {}),
          },
          options,
        ),
      );
      const story = toStory(created);
      serverStories.value = [...serverStories.value, story];
      myServerStories.value = [story, ...myServerStories.value];
      return { story };
    } catch (caught) {
      if (options.signal?.aborted && isCurrent()) return { error: 'Upload canceled.' };
      return { error: describeContentError(caught, STORY_UNAVAILABLE_MESSAGE) };
    }
  }

  /** Edit caption (author only); a blank caption removes it. Returns an error message or null. */
  async function editStory(storyId: string, caption: string): Promise<string | null> {
    const isCurrent = captureSession(auth);
    const story = findOwnStory(storyId);

    if (!story) {
      return 'Only the author can edit this story.';
    }

    const error = validateCaption(caption, STORY_CAPTION_MAX_LENGTH);

    if (error || busyStoryId.value) {
      return error;
    }

    busyStoryId.value = storyId;

    try {
      const trimmed = caption.trim();
      replaceStory(await authorized((token) => updateStoryRequest(token, storyId, trimmed || null)));
      return null;
    } catch (caught) {
      return describeContentError(caught, STORY_UNAVAILABLE_MESSAGE);
    } finally {
      if (isCurrent()) busyStoryId.value = null;
    }
  }

  /** Author only; the new audience applies immediately. Returns an error message or null. */
  async function updateStoryVisibility(
    storyId: string,
    visibility: PostVisibility,
    customViewerIds: string[],
  ): Promise<string | null> {
    const story = findOwnStory(storyId);

    if (!story) {
      return 'Only the author can change who can see this story.';
    }

    const error = validatePostAudience(visibility, customViewerIds, story.user.id, 'story');

    if (error) {
      return error;
    }

    if (visibility === 'CUSTOM' && !customViewerIds.every(isServerId)) {
      return DEMO_PEOPLE_MESSAGE;
    }

    try {
      replaceStory(
        await authorized((token) => updateStoryVisibilityRequest(token, storyId, visibility, customViewerIds)),
      );
      return null;
    } catch (caught) {
      return describeContentError(caught, STORY_UNAVAILABLE_MESSAGE);
    }
  }

  /** Delete story (author only). The server keeps the row (soft delete); nobody sees it again. */
  async function deleteStory(storyId: string): Promise<string | null> {
    const isCurrent = captureSession(auth);
    if (!findOwnStory(storyId)) {
      return 'Only the author can delete this story.';
    }

    if (busyStoryId.value) {
      return null;
    }

    busyStoryId.value = storyId;

    try {
      await authorized((token) => deleteStoryRequest(token, storyId));
    } catch (caught) {
      return describeContentError(caught, STORY_UNAVAILABLE_MESSAGE);
    } finally {
      if (isCurrent()) busyStoryId.value = null;
    }

    serverStories.value = serverStories.value.filter((candidate) => candidate.id !== storyId);
    myServerStories.value = myServerStories.value.filter((candidate) => candidate.id !== storyId);
    return null;
  }

  return {
    viewer,
    stories,
    serverStories,
    myStories,
    isLoaded,
    savesToServer,
    serverStatus,
    serverError,
    busyStoryId,
    load,
    refresh,
    getFeedAt,
    createStory,
    uploadStory,
    editStory,
    updateStoryVisibility,
    deleteStory,
  };
});
