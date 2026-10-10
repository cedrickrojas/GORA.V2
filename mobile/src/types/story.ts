import type { ApiPostPerson, PostVisibility } from './post';
import type { UserSummary } from './user';

export type StoryMediaType = 'image' | 'video';

export interface StoryMedia {
  type: StoryMediaType;
  url: string | null;
  caption: string;
  sport: string;
}

/** Mirrors Story.music* on the server. Only metadata; audio comes from a licensed provider. */
export interface StoryMusic {
  trackId: string | null;
  title: string;
  artist: string | null;
  /** Segment start in whole seconds into the track. */
  startTime: number;
  /** Segment length in seconds. */
  duration: number;
}

export interface Story {
  id: string;
  user: UserSummary;
  media: StoryMedia;
  /** Optional: a story can be posted without music. */
  music: StoryMusic | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp. Always createdAt + 24 hours. */
  expiresAt: string;
  /** Same four options as posts. Demo stories are treated as PUBLIC. */
  visibility?: PostVisibility;
  /** Only known for your own stories (the server sends the list to the author only). */
  customViewerIds?: string[];
  /** Stored in PostgreSQL (editable through the API) rather than demo data. */
  fromServer?: boolean;
}

/** GET /stories, GET /stories/mine, GET /stories/:id. */
export interface ApiStory {
  id: string;
  author: ApiPostPerson;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  visibility: PostVisibility;
  music: {
    title: string;
    artist: string | null;
    startTime: number | null;
    duration: number | null;
  } | null;
  createdAt: string;
  expiresAt: string;
  /** Only sent to the author. */
  customViewers?: ApiPostPerson[];
}

export interface CreateStoryInput {
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  caption?: string;
  visibility: PostVisibility;
  customViewerIds?: string[];
}

/** External URL creation remains available through the API. */
export interface StoryDraft {
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  caption: string;
  visibility: PostVisibility;
  customViewerIds: string[];
}

/** Add Story form selects a photo or video directly from the device. */
export interface StoryUploadDraft {
  media: File;
  caption: string;
  visibility: PostVisibility;
  customViewerIds: string[];
}

export interface StoryGroup {
  user: UserSummary;
  /** Oldest first, the order they are played in. */
  stories: Story[];
}
