import type { ProfileSections, ProfileStats } from '@/types/profile';

export interface ProfileSectionRow {
  key: string;
  title: string;
  /** A real count, or the empty state when the count is 0. */
  summary: string;
  /** The section's own page. */
  to: string;
  actionLabel: string;
  actionTo: string;
}

/** Sections shown as links in the Profile row; the rest sit under More. */
export const PROFILE_VISIBLE_SECTION_COUNT = 4;

export function splitProfileSections<T>(
  rows: readonly T[],
  visibleCount = PROFILE_VISIBLE_SECTION_COUNT,
): { visible: T[]; more: T[] } {
  return { visible: rows.slice(0, visibleCount), more: rows.slice(visibleCount) };
}

function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** The owner's section list, in the locked order. Every number comes from the API. */
export function buildProfileSections(stats: ProfileStats, sections: ProfileSections): ProfileSectionRow[] {
  return [
    sections.games > 0
      ? {
          key: 'games',
          to: '/profile/games',
          title: 'My Games',
          summary: count(sections.games, 'game'),
          actionLabel: 'View My Games',
          actionTo: '/profile/games',
        }
      : {
          key: 'games',
          to: '/profile/games',
          title: 'My Games',
          summary: "You haven't joined any games yet.",
          actionLabel: 'Discover Games',
          actionTo: '/discover',
        },
    {
      key: 'reels',
      to: '/profile/reels',
      title: 'My Reels',
      summary: sections.reels > 0 ? count(sections.reels, 'reel') : 'No reels yet.',
      actionLabel: 'View My Reels',
      actionTo: '/profile/reels',
    },
    {
      key: 'stories',
      to: '/profile/stories',
      title: 'My Stories',
      summary: sections.stories > 0 ? count(sections.stories, 'active story', 'active stories') : 'No active stories.',
      actionLabel: 'View My Stories',
      actionTo: '/profile/stories',
    },
    {
      key: 'friends',
      to: '/profile/friends',
      title: 'Friends',
      summary: stats.friends > 0 ? count(stats.friends, 'friend') : 'No friends yet.',
      actionLabel: 'View Friends',
      actionTo: '/profile/friends',
    },
    {
      key: 'followers',
      to: '/profile/followers',
      title: 'Followers',
      summary: stats.followers > 0 ? count(stats.followers, 'follower') : 'No followers yet.',
      actionLabel: 'View Followers',
      actionTo: '/profile/followers',
    },
    {
      key: 'following',
      to: '/profile/following',
      title: 'Following',
      summary: stats.following > 0 ? `Following ${count(stats.following, 'account')}` : "You don't follow anyone yet.",
      actionLabel: 'View Following',
      actionTo: '/profile/following',
    },
    {
      key: 'badges',
      to: '/profile/badges',
      title: 'Badges',
      summary: sections.badges > 0 ? `${count(sections.badges, 'badge')} unlocked` : 'No badges unlocked yet.',
      actionLabel: 'View Badges',
      actionTo: '/profile/badges',
    },
    {
      key: 'activity',
      to: '/profile/activity',
      title: 'Activity',
      summary: sections.activity > 0 ? `${count(sections.activity, 'game')} completed` : 'No completed games yet.',
      actionLabel: 'View Activity',
      actionTo: '/profile/activity',
    },
    sections.clubs > 0
      ? {
          key: 'clubs',
          to: '/profile/clubs',
          title: 'My Clubs',
          summary: count(sections.clubs, 'club'),
          actionLabel: 'View My Clubs',
          actionTo: '/profile/clubs',
        }
      : {
          key: 'clubs',
          to: '/profile/clubs',
          title: 'My Clubs',
          summary: "You haven't joined any clubs yet.",
          actionLabel: 'Find Clubs',
          actionTo: '/search',
        },
    {
      key: 'settings',
      to: '/profile/settings',
      title: 'Settings',
      summary: 'Account, Create Club, privacy, and log out.',
      actionLabel: 'Open Settings',
      actionTo: '/profile/settings',
    },
  ];
}
