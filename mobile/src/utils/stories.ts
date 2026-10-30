import type { Story, StoryGroup, StoryMusic } from '@/types/story';
import { DAY_MS } from './time';

export const STORY_LIFETIME_MS = DAY_MS;

export function getStoryExpiresAt(createdAt: string): string {
  return new Date(Date.parse(createdAt) + STORY_LIFETIME_MS).toISOString();
}

export function isStoryActive(story: Story, nowMs: number): boolean {
  return Date.parse(story.createdAt) <= nowMs && nowMs < Date.parse(story.expiresAt);
}

export function getStoryRemainingMs(story: Story, nowMs: number): number {
  return Math.max(0, Date.parse(story.expiresAt) - nowMs);
}

/** 1 when just posted, 0 when expired. */
export function getStoryLifetimeLeft(story: Story, nowMs: number): number {
  return Math.min(1, getStoryRemainingMs(story, nowMs) / STORY_LIFETIME_MS);
}

/**
 * Splits stories without discarding expired ones, so a story archive can be
 * built from `expired` later.
 */
export function partitionStories(
  stories: readonly Story[],
  nowMs: number,
): { active: Story[]; expired: Story[] } {
  const active: Story[] = [];
  const expired: Story[] = [];

  for (const story of stories) {
    (isStoryActive(story, nowMs) ? active : expired).push(story);
  }

  return { active, expired };
}

/** Groups by author. Groups with the newest story come first. */
export function groupStoriesByUser(stories: readonly Story[]): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();
  const byOldest = [...stories].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

  for (const story of byOldest) {
    const group = groups.get(story.user.id);

    if (group) {
      group.stories.push(story);
    } else {
      groups.set(story.user.id, { user: story.user, stories: [story] });
    }
  }

  return [...groups.values()].sort(
    (a, b) => getNewestStoryTime(b) - getNewestStoryTime(a),
  );
}

/** Uses the newest story, so the ring shows how long the group stays visible. */
export function getGroupLifetimeLeft(group: StoryGroup, nowMs: number): number {
  const newest = group.stories[group.stories.length - 1];

  return newest ? getStoryLifetimeLeft(newest, nowMs) : 0;
}

/** A user's story ring stays orange until every active story in that group is viewed. */
export function isStoryGroupViewed(group: StoryGroup): boolean {
  return group.stories.length > 0 && group.stories.every((story) => story.viewedByViewer === true);
}

/** The lit arc shrinks as the story ages, so the ring doubles as a countdown. */
export function getStoryRingBackground(lifetimeLeft: number): string {
  const degrees = Math.round(Math.min(1, Math.max(0, lifetimeLeft)) * 360);

  return `conic-gradient(var(--ion-color-primary) ${degrees}deg, var(--gora-ring-spent) ${degrees}deg)`;
}

function formatTrackTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "0:18–0:33" for a 15-second segment starting at 18 seconds. */
export function formatMusicSegment(music: Pick<StoryMusic, 'startTime' | 'duration'>): string {
  return `${formatTrackTime(music.startTime)}–${formatTrackTime(music.startTime + music.duration)}`;
}

function getNewestStoryTime(group: StoryGroup): number {
  const newest = group.stories[group.stories.length - 1];

  return newest ? Date.parse(newest.createdAt) : 0;
}
