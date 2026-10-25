import type { Reel } from '@/types/reel';
import { buildMockReels } from './mock/mock-catalog';

export async function fetchReels(): Promise<Reel[]> {
  return buildMockReels(Date.now());
}
