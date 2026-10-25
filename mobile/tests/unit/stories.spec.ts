import { describe, expect, test } from 'vitest';
import { buildMockStories } from '@/services/mock/mock-stories';
import {
  STORY_LIFETIME_MS,
  formatMusicSegment,
  getStoryExpiresAt,
  getStoryLifetimeLeft,
  groupStoriesByUser,
  partitionStories,
} from '@/utils/stories';
import { HOUR_MS } from '@/utils/time';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');

describe('story expiry', () => {
  test('expiresAt is createdAt plus 24 hours', () => {
    const createdAt = '2026-09-29T08:00:00.000Z';

    expect(Date.parse(getStoryExpiresAt(createdAt)) - Date.parse(createdAt)).toBe(STORY_LIFETIME_MS);
  });

  test('keeps expired stories instead of dropping them', () => {
    const stories = buildMockStories(NOW);
    const { active, expired } = partitionStories(stories, NOW);

    expect(active.length + expired.length).toBe(stories.length);
    expect(expired.map((story) => story.id).sort()).toEqual(['story-louis-expired', 'story-sam-expired']);
  });

  test('a story expires exactly 24 hours after posting', () => {
    const [story] = buildMockStories(NOW);
    const createdAtMs = Date.parse(story!.createdAt);

    expect(partitionStories([story!], createdAtMs + STORY_LIFETIME_MS - 1).active).toHaveLength(1);
    expect(partitionStories([story!], createdAtMs + STORY_LIFETIME_MS).active).toHaveLength(0);
  });

  test('lifetime left shrinks as the story ages', () => {
    const maria = buildMockStories(NOW).find((story) => story.id === 'story-maria-1')!;

    expect(getStoryLifetimeLeft(maria, NOW)).toBeCloseTo(16 / 24);
    expect(getStoryLifetimeLeft(maria, NOW + 16 * HOUR_MS)).toBe(0);
  });
});

describe('groupStoriesByUser', () => {
  test('groups by author, newest group first, stories oldest first', () => {
    const { active } = partitionStories(buildMockStories(NOW), NOW);
    const groups = groupStoriesByUser(active);

    expect(groups.map((group) => group.user.username)).toEqual(['john', 'mark', 'maria', 'alex']);
    expect(groups[0]!.stories.map((story) => story.id)).toEqual(['story-john-1', 'story-john-2']);
  });
});

describe('story music', () => {
  test('music is optional: photo or video, with or without a track', () => {
    const byId = new Map(buildMockStories(NOW).map((story) => [story.id, story]));

    expect(byId.get('story-john-1')?.music).toBeNull();
    expect(byId.get('story-john-2')?.media.type).toBe('video');
    expect(byId.get('story-john-2')?.music?.title).toBe('Fast Break');
    expect(byId.get('story-maria-1')?.media.type).toBe('image');
    expect(byId.get('story-maria-1')?.music).not.toBeNull();
  });

  test('a segment starting at 18 seconds for 15 seconds reads 0:18–0:33', () => {
    expect(formatMusicSegment({ startTime: 18, duration: 15 })).toBe('0:18–0:33');
    expect(formatMusicSegment({ startTime: 65, duration: 20 })).toBe('1:05–1:25');
  });
});
