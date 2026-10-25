import type { ReelVisibility } from '../generated/prisma/client';
import type { PostAuthor } from '../posts/post.types';

export interface ReelView {
  id: string;
  author: PostAuthor;
  caption: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  sport: { id: string; name: string } | null;
  club: { id: string; name: string } | null;
  visibility: ReelVisibility;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByViewer: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Only present for the author. Nobody else ever receives the viewer list. */
  customViewers?: PostAuthor[];
}

export interface ReelPage {
  reels: ReelView[];
  nextCursor: string | null;
}

export interface DeletedReelView {
  id: string;
  deleted: true;
}
