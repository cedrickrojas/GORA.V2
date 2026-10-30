import { copyPostLink } from '@/utils/post-share';

/** Open the device/browser share sheet, with a clipboard link fallback for desktop. */
export async function shareLink(title: string, path: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = new URL(path, window.location.origin).toString();
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  await copyPostLink(url);
  return 'copied';
}
