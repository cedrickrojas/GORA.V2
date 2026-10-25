import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import AchievementProgress from '@/components/achievements/AchievementProgress.vue';
import { mockBadges } from '@/services/mock/mock-profile';
import type { Badge } from '@/types/achievement';
import {
  getBadgeRemainingText,
  isBadgeUnlocked,
  pickShowcaseBadges,
  sortBadgesForShowcase,
} from '@/utils/badges';
import { getProgressPercent } from '@/utils/progress';

function findBadge(id: string): Badge {
  const badge = mockBadges.find((candidate) => candidate.id === id);

  if (!badge) {
    throw new Error(`Missing mock badge ${id}`);
  }

  return badge;
}

describe('getProgressPercent', () => {
  test('calculates and clamps the percentage', () => {
    expect(getProgressPercent(7, 10)).toBe(70);
    expect(getProgressPercent(15, 10)).toBe(100);
    expect(getProgressPercent(-2, 10)).toBe(0);
    expect(getProgressPercent(0, 0)).toBe(100);
  });
});

describe('badges', () => {
  test('a badge is unlocked once progress reaches the target', () => {
    const badge: Badge = { ...findBadge('badge-organizer'), progress: 25, unlocked: false };

    expect(isBadgeUnlocked(badge)).toBe(true);
    expect(isBadgeUnlocked(findBadge('badge-organizer'))).toBe(false);
  });

  test('describes what is left using the requirement unit', () => {
    expect(getBadgeRemainingText(findBadge('badge-storyteller'))).toBe('3 more stories to unlock');
    expect(getBadgeRemainingText({ ...findBadge('badge-dedicated-player'), progress: 49 })).toBe(
      '1 more game to unlock',
    );
  });

  test('showcase lists unlocked badges before locked ones', () => {
    const sorted = sortBadgesForShowcase(mockBadges);
    const firstLocked = sorted.findIndex((badge) => !isBadgeUnlocked(badge));

    expect(sorted.slice(firstLocked).every((badge) => !isBadgeUnlocked(badge))).toBe(true);
  });

  test('profile preview ends with the locked badge closest to unlocking', () => {
    const preview = pickShowcaseBadges(mockBadges, 4);

    expect(preview).toHaveLength(4);
    expect(preview.slice(0, 3).every(isBadgeUnlocked)).toBe(true);
    expect(preview[3]!.id).toBe('badge-storyteller');
  });
});

describe('AchievementProgress.vue', () => {
  test('renders the count and a bar sized from the props', () => {
    const wrapper = mount(AchievementProgress, {
      props: { current: 7, target: 10, label: 'Games Completed' },
    });

    expect(wrapper.text()).toContain('Games Completed');
    expect(wrapper.text()).toContain('7 / 10');
    expect(wrapper.find('.achievement-progress__fill').attributes('style')).toContain('width: 70%');
  });
});
