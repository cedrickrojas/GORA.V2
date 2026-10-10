import type { Story, StoryMedia, StoryMusic } from '@/types/story';
import type { UserSummary } from '@/types/user';
import { getStoryExpiresAt } from '@/utils/stories';
import { HOUR_MS, MINUTE_MS } from '@/utils/time';
import { mockCurrentUser, mockUsers } from './mock-users';

function createMockStory(
  id: string,
  user: UserSummary,
  ageMs: number,
  media: StoryMedia,
  referenceMs: number,
  music: StoryMusic | null = null,
): Story {
  const createdAt = new Date(referenceMs - ageMs).toISOString();

  return { id, user, media, music, createdAt, expiresAt: getStoryExpiresAt(createdAt) };
}

/**
 * Ages are relative to `referenceMs`, so the sample always contains a mix of
 * fresh, older, and already expired stories.
 */
export function buildMockStories(referenceMs: number): Story[] {
  return [
    createMockStory(
      'story-john-1',
      mockUsers.john,
      2 * HOUR_MS,
      { type: 'image', url: null, sport: 'Basketball', caption: 'Full court run at Rizal Park. Need 2 more.' },
      referenceMs,
    ),
    createMockStory(
      'story-john-2',
      mockUsers.john,
      45 * MINUTE_MS,
      { type: 'video', url: null, sport: 'Basketball', caption: 'Game winner from the corner.' },
      referenceMs,
      { trackId: null, title: 'Fast Break', artist: 'Courtside Collective', startTime: 18, duration: 15 },
    ),
    createMockStory(
      'story-maria-1',
      mockUsers.maria,
      8 * HOUR_MS,
      { type: 'image', url: null, sport: 'Volleyball', caption: 'Beach volleyball, sunrise session.' },
      referenceMs,
      { trackId: null, title: 'Golden Hour Rally', artist: 'Sandline', startTime: 42, duration: 20 },
    ),
    createMockStory(
      'story-alex-1',
      mockUsers.alex,
      20 * HOUR_MS,
      { type: 'image', url: null, sport: 'Football', caption: '5-a-side tonight, bring bibs.' },
      referenceMs,
    ),
    createMockStory(
      'story-mark-1',
      mockUsers.mark,
      5 * HOUR_MS,
      { type: 'video', url: null, sport: 'Tennis', caption: 'Working on the second serve.' },
      referenceMs,
    ),
    createMockStory(
      'story-louis-expired',
      mockCurrentUser,
      26 * HOUR_MS,
      { type: 'image', url: null, sport: 'Volleyball', caption: 'Tournament day recap.' },
      referenceMs,
    ),
    createMockStory(
      'story-sam-expired',
      mockUsers.sam,
      30 * HOUR_MS,
      { type: 'image', url: null, sport: 'Badminton', caption: 'Doubles night.' },
      referenceMs,
    ),
  ];
}
