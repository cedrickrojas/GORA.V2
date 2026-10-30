import type { MediaType, PostVisibility } from '../generated/prisma/client';

export interface PostAuthor {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

export interface PostLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface PostView {
  id: string;
  author: PostAuthor;
  caption: string | null;
  location: PostLocation | null;
  /** "with ..." on the card. Leaves out people the viewer cannot see (blocked or deactivated). */
  tags: PostAuthor[];
  visibility: PostVisibility;
  sportId: string | null;
  sport: { id: string; name: string } | null;
  clubId: string | null;
  isAnnouncement: boolean;
  media: {
    id: string;
    mediaType: MediaType;
    mediaUrl: string;
    thumbnailUrl: string | null;
  }[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByViewer: boolean;
  interestedByViewer?: boolean;
  notInterestedByViewer?: boolean;
  savedByViewer?: boolean;
  /** When the author last changed the caption, sport, or location; null if never. */
  editedAt: Date | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Only present for the author. Nobody else ever receives the viewer list. */
  customViewers?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  }[];
}

export interface DeletedPostView {
  id: string;
  deleted: true;
}

export interface PostPage {
  posts: PostView[];
  nextCursor: string | null;
}
