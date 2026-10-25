import type { Badge } from '@/types/achievement';
import type { ActivityStats } from '@/types/activity';
import type { FollowSummary, UserProfile } from '@/types/profile';
import { mockCurrentUser, mockUsers } from './mock-users';

export function buildMockProfile(): UserProfile {
  return {
    ...mockCurrentUser,
    headline: 'Volleyball Player',
    bio: 'Outside hitter from Imus. I host weekend 6v6 runs, so message me if you need one more player.',
    coverImageUrl: null,
    sports: [
      { id: 'sport-volleyball', name: 'Volleyball', role: 'Outside hitter' },
      { id: 'sport-basketball', name: 'Basketball', role: 'Point guard' },
      { id: 'sport-badminton', name: 'Badminton', role: 'Doubles' },
    ],
    highlights: [
      { id: 'highlight-1', title: 'Cross-court kill', sport: 'Volleyball', durationSeconds: 14, views: 1280 },
      { id: 'highlight-2', title: 'Block party', sport: 'Volleyball', durationSeconds: 22, views: 864 },
      { id: 'highlight-3', title: 'Buzzer three', sport: 'Basketball', durationSeconds: 9, views: 2310 },
    ],
  };
}

/** Louis follows John, Maria, and Carlo (among accounts outside this sample). */
export function buildMockFollowSummary(): FollowSummary {
  return {
    followersCount: 245,
    followingCount: 128,
    followingIds: [mockUsers.john.id, mockUsers.maria.id, mockUsers.carlo.id],
  };
}

export const mockActivityStats: ActivityStats = {
  gamesJoined: 38,
  gamesCompleted: 32,
  gamesHosted: 12,
  highlightsUploaded: 24,
  storiesPosted: 47,
  friendsCount: 156,
  sportsParticipated: 3,
};

const games = { singular: 'game', plural: 'games' };

export const mockBadges: Badge[] = [
  {
    id: 'badge-first-game',
    name: 'First Game',
    description: 'Join your first sports game.',
    icon: 'flag',
    category: 'GAMES',
    requirement: { metric: 'gamesJoined', text: 'Join 1 game', unit: games },
    unlocked: true,
    progress: 1,
    target: 1,
  },
  {
    id: 'badge-team-player',
    name: 'Team Player',
    description: 'Join 50 sports games.',
    icon: 'people',
    category: 'GAMES',
    requirement: { metric: 'gamesJoined', text: 'Join 50 games', unit: games },
    unlocked: false,
    progress: 38,
    target: 50,
  },
  {
    id: 'badge-getting-started',
    name: 'Getting Started',
    description: 'Complete 5 sports games.',
    icon: 'rocket',
    category: 'COMPLETION',
    requirement: { metric: 'gamesCompleted', text: 'Complete 5 games', unit: games },
    unlocked: true,
    progress: 5,
    target: 5,
  },
  {
    id: 'badge-active-player',
    name: 'Active Player',
    description: 'Complete 10 sports games.',
    icon: 'flash',
    category: 'COMPLETION',
    requirement: { metric: 'gamesCompleted', text: 'Complete 10 games', unit: games },
    unlocked: true,
    progress: 10,
    target: 10,
  },
  {
    id: 'badge-dedicated-player',
    name: 'Dedicated Player',
    description: 'Complete 50 sports games.',
    icon: 'trophy',
    category: 'COMPLETION',
    requirement: { metric: 'gamesCompleted', text: 'Complete 50 games', unit: games },
    unlocked: false,
    progress: 32,
    target: 50,
  },
  {
    id: 'badge-veteran',
    name: 'Veteran',
    description: 'Complete 100 sports games.',
    icon: 'medal',
    category: 'COMPLETION',
    requirement: { metric: 'gamesCompleted', text: 'Complete 100 games', unit: games },
    unlocked: false,
    progress: 32,
    target: 100,
  },
  {
    id: 'badge-game-host',
    name: 'Game Host',
    description: 'Host your first game.',
    icon: 'megaphone',
    category: 'HOSTING',
    requirement: { metric: 'gamesHosted', text: 'Host 1 game', unit: games },
    unlocked: true,
    progress: 1,
    target: 1,
  },
  {
    id: 'badge-organizer',
    name: 'Organizer',
    description: 'Host 25 games for the community.',
    icon: 'calendar',
    category: 'HOSTING',
    requirement: { metric: 'gamesHosted', text: 'Host 25 games', unit: games },
    unlocked: false,
    progress: 12,
    target: 25,
  },
  {
    id: 'badge-highlight-creator',
    name: 'Highlight Creator',
    description: 'Upload your first highlight.',
    icon: 'videocam',
    category: 'HIGHLIGHTS',
    requirement: {
      metric: 'highlightsUploaded',
      text: 'Upload 1 highlight',
      unit: { singular: 'highlight', plural: 'highlights' },
    },
    unlocked: true,
    progress: 1,
    target: 1,
  },
  {
    id: 'badge-highlight-maker',
    name: 'Highlight Maker',
    description: 'Upload 50 highlights.',
    icon: 'film',
    category: 'HIGHLIGHTS',
    requirement: {
      metric: 'highlightsUploaded',
      text: 'Upload 50 highlights',
      unit: { singular: 'highlight', plural: 'highlights' },
    },
    unlocked: false,
    progress: 24,
    target: 50,
  },
  {
    id: 'badge-storyteller',
    name: 'Storyteller',
    description: 'Post 50 stories from your games.',
    icon: 'book',
    category: 'STORIES',
    requirement: {
      metric: 'storiesPosted',
      text: 'Post 50 stories',
      unit: { singular: 'story', plural: 'stories' },
    },
    unlocked: false,
    progress: 47,
    target: 50,
  },
  {
    id: 'badge-social-player',
    name: 'Social Player',
    description: 'Make 25 friends on GORA.',
    icon: 'heart',
    category: 'SOCIAL',
    requirement: {
      metric: 'friendsCount',
      text: 'Make 25 friends',
      unit: { singular: 'friend', plural: 'friends' },
    },
    unlocked: true,
    progress: 25,
    target: 25,
  },
  {
    id: 'badge-community-player',
    name: 'Community Player',
    description: 'Play 5 different sports.',
    icon: 'globe',
    category: 'COMMUNITY',
    requirement: {
      metric: 'sportsParticipated',
      text: 'Play 5 sports',
      unit: { singular: 'sport', plural: 'sports' },
    },
    unlocked: false,
    progress: 3,
    target: 5,
  },
];
