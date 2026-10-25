import type {
  PostVisibility,
  StoryMediaType,
} from '../generated/prisma/client';
import type { PostAuthor } from '../posts/post.types';

export interface StoryView {
  id: string;
  author: PostAuthor;
  mediaType: StoryMediaType;
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
  createdAt: Date;
  expiresAt: Date;
  /** Only present for the author. Nobody else ever receives the viewer list. */
  customViewers?: PostAuthor[];
}

export interface DeletedStoryView {
  id: string;
  deleted: true;
}
