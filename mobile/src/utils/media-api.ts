import type { Highlight } from '@/types/profile';
import type { ApiReel, Reel, ReelDraft } from '@/types/reel';
import type { ApiStory, Story, StoryDraft } from '@/types/story';
import { toUserSummary } from './display-name';
import { NO_SPORT_LABEL } from './post-api';
import { validatePostAudience } from './post-privacy';
import { getApiBaseUrl } from '@/services/api-config';

/** The same limits as the server (CHECK constraints and DTOs). */
export const STORY_CAPTION_MAX_LENGTH = 500;
export const REEL_CAPTION_MAX_LENGTH = 2200;
export const MEDIA_URL_MAX_LENGTH = 2048;

export function toStory(story: ApiStory): Story {
  return {
    id: story.id,
    user: toUserSummary(story.author),
    media: {
      type: story.mediaType === 'VIDEO' ? 'video' : 'image',
      url: story.mediaUrl.startsWith('/api/v1/stories/') ? `${getApiBaseUrl()}${story.mediaUrl}` : story.mediaUrl,
      caption: story.caption ?? '',
      sport: '',
    },
    music: story.music
      ? {
          trackId: null,
          title: story.music.title,
          artist: story.music.artist,
          startTime: story.music.startTime ?? 0,
          duration: story.music.duration ?? 0,
        }
      : null,
    createdAt: story.createdAt,
    expiresAt: story.expiresAt,
    viewedByViewer: story.viewedByViewer,
    visibility: story.visibility,
    customViewerIds: story.customViewers?.map((viewer) => viewer.id),
    fromServer: true,
  };
}

export function toReel(reel: ApiReel): Reel {
  return {
    id: reel.id,
    author: toUserSummary(reel.author),
    club: null,
    sport: reel.sport?.name ?? NO_SPORT_LABEL,
    caption: reel.caption ?? '',
    locationName: '',
    videoUrl: reel.videoUrl.startsWith('/api/v1/reels/') ? `${getApiBaseUrl()}${reel.videoUrl}` : reel.videoUrl,
    thumbnailUrl: reel.thumbnailUrl,
    durationSeconds: reel.durationSeconds ?? 0,
    views: reel.viewCount,
    likes: reel.likeCount,
    comments: reel.commentCount,
    shares: reel.shareCount,
    likedByViewer: reel.likedByViewer,
    createdAt: reel.createdAt,
    visibility: reel.visibility,
    customViewerIds: reel.customViewers?.map((viewer) => viewer.id),
    fromServer: true,
  };
}

/** A reel shown in Profile → Highlights and My Reels. */
export function toHighlight(reel: Reel): Highlight {
  return {
    id: reel.id,
    videoUrl: reel.videoUrl,
    title: reel.caption.trim() || `${reel.sport} highlight`,
    sport: reel.sport,
    durationSeconds: reel.durationSeconds,
    views: reel.views,
    visibility: reel.visibility,
    fromServer: reel.fromServer,
  };
}

/** http(s) only, like the server's IsUrl({ protocols: ['http', 'https'] }). */
export function isMediaUrl(value: string): boolean {
  const url = value.trim();

  if (url.length === 0 || url.length > MEDIA_URL_MAX_LENGTH) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

export function validateCaption(caption: string, maxLength: number): string | null {
  return caption.trim().length > maxLength ? `Captions can be up to ${maxLength} characters.` : null;
}

/** The same rules as POST /stories. Returns a message, or null when the story can be posted. */
export function validateStoryDraft(draft: StoryDraft, authorId: string | null): string | null {
  if (!isMediaUrl(draft.mediaUrl)) {
    return `Paste a link to the ${draft.mediaType === 'VIDEO' ? 'video' : 'photo'} (http or https).`;
  }

  return (
    validateCaption(draft.caption, STORY_CAPTION_MAX_LENGTH) ??
    validatePostAudience(draft.visibility, draft.customViewerIds, authorId, 'story')
  );
}

/** The same rules as POST /reels. Returns a message, or null when the reel can be uploaded. */
export function validateReelDraft(draft: ReelDraft, authorId: string | null): string | null {
  if (!isMediaUrl(draft.videoUrl)) {
    return 'Paste a link to the video (http or https).';
  }

  if (draft.thumbnailUrl.trim().length > 0 && !isMediaUrl(draft.thumbnailUrl)) {
    return 'The thumbnail must be an http or https link.';
  }

  return (
    validateCaption(draft.caption, REEL_CAPTION_MAX_LENGTH) ??
    validatePostAudience(draft.visibility, draft.customViewerIds, authorId, 'reel')
  );
}
