import type { ClubSummary } from './club';
import type { UserSummary } from './user';

/**
 * Mirrors the server's PostVisibility enum. The server decides who receives a post;
 * the client only mirrors those rules for mock data and never relies on them for privacy.
 */
export type PostVisibility = 'PUBLIC' | 'FRIENDS' | 'CUSTOM' | 'ONLY_ME';

/** Mirrors PostMedia. Videos are modeled now and shown once uploads exist. */
export interface PostMediaItem {
  id: string;
  type: 'image' | 'video';
  /** External storage URL, or null for mock media without a file. */
  url: string | null;
}

/**
 * Mirrors Post.locationName/latitude/longitude: a place the author picked for the post,
 * never their home or live position. Separate from a game's venue.
 */
export interface PostLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface FeedPost {
  id: string;
  sharedPostId?: string | null;
  /** The source post, included only when this viewer is allowed to see it. */
  sharedPost?: FeedPost | null;
  /** Always the person who wrote it, also for club posts. */
  author: UserSummary;
  /** Set when the post was made in a club (Post.clubId). */
  club?: ClubSummary | null;
  isAnnouncement?: boolean;
  /** The caption. A post can be text only, media only, or both. */
  body: string;
  sport: string;
  media: PostMediaItem[];
  visibility: PostVisibility;
  /**
   * The chosen people for a CUSTOM post (PostCustomViewer). The API sends this only to the
   * author; the UI never shows it to anyone else.
   */
  customViewerIds?: string[];
  /** People tagged in the post (PostTag), shown as "with ...". Only the author changes them. */
  tags?: UserSummary[];
  location?: PostLocation | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** When the author last edited the caption, sport, or location ("Edited"). */
  editedAt?: string | null;
  archivedAt?: string | null;
  /** Stored in PostgreSQL (from the posts API); demo posts leave this unset. */
  fromServer?: boolean;
  likes: number;
  comments: number;
  shares: number;
  likedByViewer: boolean;
  interestedByViewer?: boolean;
  notInterestedByViewer?: boolean;
  savedByViewer?: boolean;
}

/** Edit Post: caption, sport, and location. Privacy and tags have their own editors. */
export interface PostEdit {
  body: string;
  sport: string;
  location: PostLocation | null;
}

export interface ApiPostPerson {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

/** GET /posts, GET /posts/:id, and GET /users/:username/posts. */
export interface ApiPost {
  id: string;
  sharedPostId?: string | null;
  sharedPost?: ApiPost | null;
  author: ApiPostPerson;
  caption: string | null;
  location: PostLocation | null;
  tags: ApiPostPerson[];
  visibility: PostVisibility;
  sportId: string | null;
  sport: { id: string; name: string } | null;
  clubId: string | null;
  isAnnouncement: boolean;
  media: { id: string; mediaType: 'IMAGE' | 'VIDEO'; mediaUrl: string; thumbnailUrl: string | null }[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByViewer: boolean;
  interestedByViewer?: boolean;
  notInterestedByViewer?: boolean;
  savedByViewer?: boolean;
  editedAt: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only sent to the author. */
  customViewers?: { id: string; username: string; firstName: string; lastName: string }[];
}

export interface ApiPostPage {
  posts: ApiPost[];
  nextCursor: string | null;
}

export interface CreatePostInput {
  caption: string;
  sharedPostId?: string;
  photos?: string[];
  visibility: PostVisibility;
  sportId?: string;
  customViewerIds?: string[];
  taggedUserIds?: string[];
  location?: PostLocation;
}

export interface ApiPostComment {
  id: string;
  content: string;
  createdAt: string;
  author: ApiPostPerson;
}

export interface ApiPostCommentPage {
  comments: ApiPostComment[];
  nextCursor: string | null;
}

/** PATCH /posts/:id: only the fields sent change; null removes the sport or the location. */
export interface UpdatePostInput {
  caption?: string;
  sportId?: string | null;
  location?: PostLocation | null;
}

export interface PostDraft {
  body: string;
  sharedPostId?: string;
  sport: string;
  visibility: PostVisibility;
  /** Required and non-empty for CUSTOM, empty otherwise. */
  customViewerIds: string[];
  taggedUserIds: string[];
  location: PostLocation | null;
  /** Local preview URLs until the upload service exists. */
  photoUrls: string[];
}
