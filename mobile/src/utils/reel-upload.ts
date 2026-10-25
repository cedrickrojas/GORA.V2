export const REEL_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const REEL_VIDEO_MAX_SECONDS = 600;

export function validateReelVideo(file: File): string | null {
  if (file.size === 0) return 'This video is empty. Choose another file.';
  if (file.size > REEL_VIDEO_MAX_BYTES) return 'Videos must be 50 MB or smaller.';
  if (!['video/mp4', 'video/webm'].includes(file.type)) return 'Choose an MP4 or WebM video.';
  return null;
}
