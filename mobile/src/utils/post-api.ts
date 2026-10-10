import type { ApiPost, FeedPost, PostEdit } from '@/types/post';
import { toUserSummary } from './display-name';
import { POST_CAPTION_MAX_LENGTH } from './feed';
import { validatePostLocation } from './post-details';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Posts and accounts stored in PostgreSQL have UUID ids; the demo data uses readable ids. */
export function isServerId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

/** A post without a sport still needs a label on the card and in the sport filter. */
export const NO_SPORT_LABEL = 'Other';

export function toFeedPost(post: ApiPost): FeedPost {
  return {
    id: post.id,
    author: toUserSummary(post.author),
    isAnnouncement: post.isAnnouncement,
    body: post.caption ?? '',
    sport: post.sport?.name ?? NO_SPORT_LABEL,
    media: post.media.map((item) => ({
      id: item.id,
      type: item.mediaType === 'VIDEO' ? 'video' : 'image',
      url: item.mediaUrl,
    })),
    visibility: post.visibility,
    customViewerIds: post.customViewers?.map((viewer) => viewer.id),
    tags: post.tags.map((person) => toUserSummary(person)),
    location: post.location,
    createdAt: post.createdAt,
    editedAt: post.editedAt,
    fromServer: true,
    likes: post.likeCount,
    comments: post.commentCount,
    shares: post.shareCount,
    likedByViewer: post.likedByViewer,
  };
}

/** The same rules as PATCH /posts/:id. Returns a message, or null when the edit is valid. */
export function validatePostEdit(edit: PostEdit): string | null {
  const caption = edit.body.trim();

  if (caption.length === 0) {
    return 'Write something to post.';
  }

  if (caption.length > POST_CAPTION_MAX_LENGTH) {
    return `Captions can be up to ${POST_CAPTION_MAX_LENGTH} characters.`;
  }

  if (edit.sport.length === 0) {
    return 'Choose a sport.';
  }

  return validatePostLocation(edit.location);
}
