import {
  bookOutline,
  calendarOutline,
  filmOutline,
  flagOutline,
  flashOutline,
  globeOutline,
  heartOutline,
  medalOutline,
  megaphoneOutline,
  peopleOutline,
  rocketOutline,
  trophyOutline,
  videocamOutline,
} from 'ionicons/icons';
import type { Badge, BadgeCategory, BadgeIcon } from '@/types/achievement';
import { getProgressPercent, getRemaining } from './progress';

export const BADGE_ICONS: Record<BadgeIcon, string> = {
  flag: flagOutline,
  people: peopleOutline,
  rocket: rocketOutline,
  flash: flashOutline,
  trophy: trophyOutline,
  medal: medalOutline,
  megaphone: megaphoneOutline,
  calendar: calendarOutline,
  videocam: videocamOutline,
  film: filmOutline,
  book: bookOutline,
  heart: heartOutline,
  globe: globeOutline,
};

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  GAMES: 'Playing',
  COMPLETION: 'Completing',
  HOSTING: 'Hosting',
  HIGHLIGHTS: 'Highlights',
  STORIES: 'Stories',
  SOCIAL: 'Friends',
  COMMUNITY: 'Community',
};

const CATEGORY_ORDER: readonly BadgeCategory[] = [
  'GAMES',
  'COMPLETION',
  'HOSTING',
  'HIGHLIGHTS',
  'STORIES',
  'SOCIAL',
  'COMMUNITY',
];

export function isBadgeUnlocked(badge: Badge): boolean {
  return badge.unlocked || badge.progress >= badge.target;
}

export function getBadgeRemainingText(badge: Badge): string {
  const remaining = getRemaining(badge.progress, badge.target);
  const { singular, plural } = badge.requirement.unit;

  return `${remaining} more ${remaining === 1 ? singular : plural} to unlock`;
}

/** Unlocked first, then locked badges closest to unlocking. */
export function sortBadgesForShowcase(badges: readonly Badge[]): Badge[] {
  return [...badges].sort((a, b) => {
    const unlockedDiff = Number(isBadgeUnlocked(b)) - Number(isBadgeUnlocked(a));

    if (unlockedDiff !== 0) {
      return unlockedDiff;
    }

    return (
      getProgressPercent(b.progress, b.target) - getProgressPercent(a.progress, a.target)
    );
  });
}

/** Leaves the last slot for the locked badge nearest to unlocking, when there is one. */
export function pickShowcaseBadges(badges: readonly Badge[], count: number): Badge[] {
  const sorted = sortBadgesForShowcase(badges);
  const unlocked = sorted.filter(isBadgeUnlocked);
  const locked = sorted.filter((badge) => !isBadgeUnlocked(badge));
  const picked = unlocked.slice(0, locked.length > 0 ? count - 1 : count);

  return [...picked, ...locked.slice(0, count - picked.length)];
}

export function groupBadgesByCategory(
  badges: readonly Badge[],
): { category: BadgeCategory; label: string; badges: Badge[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: BADGE_CATEGORY_LABELS[category],
    badges: badges.filter((badge) => badge.category === category),
  })).filter((group) => group.badges.length > 0);
}
