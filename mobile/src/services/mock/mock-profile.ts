import type { Badge, BadgeCategory, BadgeIcon } from '@/types/achievement';
import type { ActivityMetric, ActivityStats } from '@/types/activity';
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

const additionalBadgeSpecs: Array<{
  id: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  category: BadgeCategory;
  metric: ActivityMetric | 'goraPoints';
  target: number;
  text: string;
  singular: string;
  plural: string;
}> = [
  { id: 'court-regular', name: 'Court Regular', description: 'Join 10 sports games.', icon: 'calendar', category: 'GAMES', metric: 'gamesJoined', target: 10, text: 'Join 10 games', singular: 'game', plural: 'games' },
  { id: 'first-team', name: 'First Team', description: 'Join 25 sports games.', icon: 'people', category: 'GAMES', metric: 'gamesJoined', target: 25, text: 'Join 25 games', singular: 'game', plural: 'games' },
  { id: 'pickup-legend', name: 'Pickup Legend', description: 'Join 100 sports games.', icon: 'trophy', category: 'GAMES', metric: 'gamesJoined', target: 100, text: 'Join 100 games', singular: 'game', plural: 'games' },
  { id: 'reliable-finisher', name: 'Reliable Finisher', description: 'Complete your first sports game.', icon: 'flag', category: 'COMPLETION', metric: 'gamesCompleted', target: 1, text: 'Complete 1 game', singular: 'game', plural: 'games' },
  { id: 'consistent-player', name: 'Consistent Player', description: 'Complete 25 sports games.', icon: 'flash', category: 'COMPLETION', metric: 'gamesCompleted', target: 25, text: 'Complete 25 games', singular: 'game', plural: 'games' },
  { id: 'century-club', name: 'Century Club', description: 'Complete 100 sports games.', icon: 'medal', category: 'COMPLETION', metric: 'gamesCompleted', target: 100, text: 'Complete 100 games', singular: 'game', plural: 'games' },
  { id: 'iron-athlete', name: 'Iron Athlete', description: 'Complete 250 sports games.', icon: 'rocket', category: 'COMPLETION', metric: 'gamesCompleted', target: 250, text: 'Complete 250 games', singular: 'game', plural: 'games' },
  { id: 'weekend-captain', name: 'Weekend Captain', description: 'Host 5 games for your community.', icon: 'megaphone', category: 'HOSTING', metric: 'gamesHosted', target: 5, text: 'Host 5 games', singular: 'game', plural: 'games' },
  { id: 'community-captain', name: 'Community Captain', description: 'Host 10 games for your community.', icon: 'people', category: 'HOSTING', metric: 'gamesHosted', target: 10, text: 'Host 10 games', singular: 'game', plural: 'games' },
  { id: 'league-builder', name: 'League Builder', description: 'Host 50 games for your community.', icon: 'calendar', category: 'HOSTING', metric: 'gamesHosted', target: 50, text: 'Host 50 games', singular: 'game', plural: 'games' },
  { id: 'clip-collector', name: 'Clip Collector', description: 'Upload 10 game highlights.', icon: 'film', category: 'HIGHLIGHTS', metric: 'highlightsUploaded', target: 10, text: 'Upload 10 highlights', singular: 'highlight', plural: 'highlights' },
  { id: 'highlight-pro', name: 'Highlight Pro', description: 'Upload 25 game highlights.', icon: 'videocam', category: 'HIGHLIGHTS', metric: 'highlightsUploaded', target: 25, text: 'Upload 25 highlights', singular: 'highlight', plural: 'highlights' },
  { id: 'highlight-legend', name: 'Highlight Legend', description: 'Upload 100 game highlights.', icon: 'trophy', category: 'HIGHLIGHTS', metric: 'highlightsUploaded', target: 100, text: 'Upload 100 highlights', singular: 'highlight', plural: 'highlights' },
  { id: 'story-starter', name: 'Story Starter', description: 'Post your first game story.', icon: 'book', category: 'STORIES', metric: 'storiesPosted', target: 1, text: 'Post 1 story', singular: 'story', plural: 'stories' },
  { id: 'game-day-reporter', name: 'Game Day Reporter', description: 'Post 25 game stories.', icon: 'film', category: 'STORIES', metric: 'storiesPosted', target: 25, text: 'Post 25 stories', singular: 'story', plural: 'stories' },
  { id: 'daily-storyteller', name: 'Daily Storyteller', description: 'Post 100 game stories.', icon: 'flash', category: 'STORIES', metric: 'storiesPosted', target: 100, text: 'Post 100 stories', singular: 'story', plural: 'stories' },
  { id: 'friendly-face', name: 'Friendly Face', description: 'Make your first friend on GORA.', icon: 'heart', category: 'SOCIAL', metric: 'friendsCount', target: 1, text: 'Make 1 friend', singular: 'friend', plural: 'friends' },
  { id: 'team-networker', name: 'Team Networker', description: 'Make 100 friends on GORA.', icon: 'people', category: 'SOCIAL', metric: 'friendsCount', target: 100, text: 'Make 100 friends', singular: 'friend', plural: 'friends' },
  { id: 'everyones-teammate', name: "Everyone's Teammate", description: 'Make 250 friends on GORA.', icon: 'globe', category: 'SOCIAL', metric: 'friendsCount', target: 250, text: 'Make 250 friends', singular: 'friend', plural: 'friends' },
  { id: 'multi-sport-athlete', name: 'Multi-Sport Athlete', description: 'Play 3 different sports.', icon: 'flash', category: 'COMMUNITY', metric: 'sportsParticipated', target: 3, text: 'Play 3 sports', singular: 'sport', plural: 'sports' },
  { id: 'all-rounder', name: 'All-Rounder', description: 'Play 7 different sports.', icon: 'globe', category: 'COMMUNITY', metric: 'sportsParticipated', target: 7, text: 'Play 7 sports', singular: 'sport', plural: 'sports' },
  { id: 'sports-explorer', name: 'Sports Explorer', description: 'Play 10 different sports.', icon: 'rocket', category: 'COMMUNITY', metric: 'sportsParticipated', target: 10, text: 'Play 10 sports', singular: 'sport', plural: 'sports' },
  { id: 'torch-spark', name: 'Torch Spark', description: 'Earn 10 GORA Points.', icon: 'flash', category: 'POINTS', metric: 'goraPoints', target: 10, text: 'Earn 10 points', singular: 'point', plural: 'points' },
  { id: 'first-flame', name: 'First Flame', description: 'Earn 50 GORA Points.', icon: 'flag', category: 'POINTS', metric: 'goraPoints', target: 50, text: 'Earn 50 points', singular: 'point', plural: 'points' },
  { id: 'burning-bright', name: 'Burning Bright', description: 'Earn 150 GORA Points.', icon: 'flash', category: 'POINTS', metric: 'goraPoints', target: 150, text: 'Earn 150 points', singular: 'point', plural: 'points' },
  { id: 'torchbearer', name: 'Torchbearer', description: 'Earn 300 GORA Points.', icon: 'trophy', category: 'POINTS', metric: 'goraPoints', target: 300, text: 'Earn 300 points', singular: 'point', plural: 'points' },
  { id: 'eternal-flame', name: 'Eternal Flame', description: 'Earn 1,000 GORA Points.', icon: 'medal', category: 'POINTS', metric: 'goraPoints', target: 1000, text: 'Earn 1,000 points', singular: 'point', plural: 'points' },
];

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
  ...additionalBadgeSpecs.map((badge) => {
    const progress = badge.metric === 'goraPoints' ? 0 : mockActivityStats[badge.metric];
    return {
      id: `badge-${badge.id}`,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      requirement: {
        metric: badge.metric,
        text: badge.text,
        unit: { singular: badge.singular, plural: badge.plural },
      },
      unlocked: progress >= badge.target,
      progress,
      target: badge.target,
    };
  }),
];
