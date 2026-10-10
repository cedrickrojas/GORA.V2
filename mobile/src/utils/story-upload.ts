export const STORY_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const STORY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const STORY_MEDIA_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm';

export function storyFileType(file: File): 'IMAGE' | 'VIDEO' | null {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return 'IMAGE';
  if (['video/mp4', 'video/webm'].includes(file.type)) return 'VIDEO';
  return null;
}

export function validateStoryFile(file: File): string | null {
  const type = storyFileType(file);
  if (!type) return 'Choose a JPEG, PNG, WebP or GIF photo, or an MP4 or WebM video.';
  if (!file.size) return 'This file is empty. Choose another file.';
  if (file.size > (type === 'IMAGE' ? STORY_PHOTO_MAX_BYTES : STORY_VIDEO_MAX_BYTES))
    return type === 'IMAGE' ? 'Photos must be 10 MB or smaller.' : 'Videos must be 50 MB or smaller.';
  return null;
}
