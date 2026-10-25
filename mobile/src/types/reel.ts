import type { ClubSummary } from './club';
import type { ApiPostPerson, PostVisibility } from './post';
import type { UserSummary } from './user';

export interface Reel {
  id: string;
  author: UserSummary;
  club?: ClubSummary | null;
  sport: string;
  caption: string;
  locationName: string;
  videoUrl: string | null;
  durationSeconds: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  likedByViewer: boolean;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** Same four options as posts. Demo reels are treated as PUBLIC. */
  visibility?: PostVisibility;
  /** Only known for your own reels (the server sends the list to the author only). */
  customViewerIds?: string[];
  thumbnailUrl?: string | null;
  /** Stored in PostgreSQL (editable through the API) rather than demo data. */
  fromServer?: boolean;
}

/** GET /reels, GET /reels/:id, GET /users/:username/reels. */
export interface ApiReel {
  id: string;
  author: ApiPostPerson;
  caption: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  sport: { id: string; name: string } | null;
  club: { id: string; name: string } | null;
  visibility: PostVisibility;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByViewer: boolean;
  createdAt: string;
  updatedAt: string;
  /** Only sent to the author. */
  customViewers?: ApiPostPerson[];
}

export interface ApiReelPage {
  reels: ApiReel[];
  nextCursor: string | null;
}

export interface CreateReelInput {
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  sportId?: string;
  durationSeconds?: number;
  visibility: PostVisibility;
  customViewerIds?: string[];
}

/** PATCH /reels/:id: only the fields sent change; null removes the caption or the sport. */
export interface UpdateReelInput {
  caption?: string | null;
  sportId?: string | null;
}

/** Legacy external-link creation, still supported by the API. */
export interface ReelDraft {
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  /** A sport name, or '' for none. */
  sport: string;
  visibility: PostVisibility;
  customViewerIds: string[];
}

export interface ReelUploadDraft extends Omit<ReelDraft, 'videoUrl' | 'thumbnailUrl'> {
  video: File;
  durationSeconds: number;
}
