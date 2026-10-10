import type { AppNotification } from '@/types/notification';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '@/utils/time';
import { mockUsers } from './mock-users';

/** Mirrors the game flow: join request -> host accepts -> game completed -> badge unlocked. */
export function buildMockNotifications(referenceMs: number): AppNotification[] {
  const ago = (offsetMs: number): string => new Date(referenceMs - offsetMs).toISOString();

  return [
    {
      id: 'notif-join-request',
      type: 'JOIN_REQUEST',
      actor: mockUsers.mark,
      title: 'New join request',
      body: 'Mark Villanueva wants to join Weekend 6v6 Volleyball.',
      createdAt: ago(12 * MINUTE_MS),
      read: false,
      link: '/profile/games',
    },
    {
      id: 'notif-accepted',
      type: 'REQUEST_ACCEPTED',
      actor: mockUsers.john,
      title: 'Request accepted',
      body: 'John Reyes accepted you into Full Court Night Run. You are now a participant.',
      createdAt: ago(2 * HOUR_MS),
      read: false,
      link: '/profile/games',
    },
    {
      id: 'notif-badge',
      type: 'BADGE_UNLOCKED',
      actor: null,
      title: 'Badge unlocked: Social Player',
      body: 'You made 25 friends on GORA.',
      createdAt: ago(DAY_MS),
      read: false,
      link: '/profile/badges',
    },
    {
      id: 'notif-completed',
      type: 'GAME_COMPLETED',
      actor: mockUsers.maria,
      title: 'Game completed',
      body: 'Beach Volleyball Cup is complete. Your activity has been updated.',
      createdAt: ago(DAY_MS + HOUR_MS),
      read: true,
      link: '/profile/activity',
    },
    {
      id: 'notif-friend',
      type: 'FRIEND_REQUEST',
      actor: mockUsers.bea,
      title: 'Friend request',
      body: 'Bea Lim sent you a friend request.',
      createdAt: ago(2 * DAY_MS),
      read: true,
      link: '/profile/friends?tab=requests',
    },
    {
      id: 'notif-reel-like',
      type: 'REEL_LIKED',
      actor: mockUsers.kim,
      title: 'Reel liked',
      body: 'Kim Navarro liked your Cross-court kill reel.',
      createdAt: ago(3 * DAY_MS),
      read: true,
      link: '/profile/reels',
    },
  ];
}
