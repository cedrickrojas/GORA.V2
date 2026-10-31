import type { Story } from '@/types/story';

/** Stories are shown only when loaded from a real account-backed source. */
export async function fetchStories(): Promise<Story[]> {
  return [];
}
