import type { Story } from '@/types/story';
import { buildMockStories } from './mock/mock-stories';

/** Returns every story, including expired ones. Callers filter for display. */
export async function fetchStories(): Promise<Story[]> {
  return buildMockStories(Date.now());
}
