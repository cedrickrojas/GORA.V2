import type {
  BadgeCategory,
  BadgeRequirement,
} from '../src/generated/prisma/enums';

export interface SportSeed {
  name: string;
  description: string;
}

export interface BadgeSeed {
  name: string;
  description: string;
  category: BadgeCategory;
  requirement: BadgeRequirement;
  target: number;
}

export const SPORT_SEEDS: readonly SportSeed[] = [
  {
    name: 'Basketball',
    description: 'Pickup runs, 3x3, and full-court games.',
  },
  { name: 'Volleyball', description: 'Indoor, beach, and casual court games.' },
  { name: 'Badminton', description: 'Singles and doubles court sessions.' },
  {
    name: 'Football',
    description: 'Futsal, 7-a-side, and full-field matches.',
  },
  { name: 'Tennis', description: 'Singles, doubles, and rally sessions.' },
  { name: 'Running', description: 'Group runs, intervals, and race training.' },
  { name: 'Table Tennis', description: 'Ping pong matches and practice.' },
  { name: 'Swimming', description: 'Laps, open water, and swim training.' },
  { name: 'Cycling', description: 'Road rides, trails, and group spins.' },
  { name: 'Other', description: 'Any sport not listed yet.' },
];

export const BADGE_SEEDS: readonly BadgeSeed[] = [
  {
    name: 'First Game',
    description: 'Join your first sports game.',
    category: 'GAMES',
    requirement: 'GAMES_JOINED',
    target: 1,
  },
  {
    name: 'Getting Started',
    description: 'Complete 5 sports games.',
    category: 'COMPLETION',
    requirement: 'GAMES_COMPLETED',
    target: 5,
  },
  {
    name: 'Active Player',
    description: 'Complete 10 sports games.',
    category: 'COMPLETION',
    requirement: 'GAMES_COMPLETED',
    target: 10,
  },
  {
    name: 'Dedicated Player',
    description: 'Complete 50 sports games.',
    category: 'COMPLETION',
    requirement: 'GAMES_COMPLETED',
    target: 50,
  },
  {
    name: 'Veteran',
    description: 'Complete 100 sports games.',
    category: 'COMPLETION',
    requirement: 'GAMES_COMPLETED',
    target: 100,
  },
  {
    name: 'Game Host',
    description: 'Host your first game.',
    category: 'HOSTING',
    requirement: 'GAMES_HOSTED',
    target: 1,
  },
  {
    name: 'Organizer',
    description: 'Host 25 games for the community.',
    category: 'HOSTING',
    requirement: 'GAMES_HOSTED',
    target: 25,
  },
  {
    name: 'Team Player',
    description: 'Join 50 sports games.',
    category: 'GAMES',
    requirement: 'GAMES_JOINED',
    target: 50,
  },
  {
    name: 'Highlight Creator',
    description: 'Upload your first highlight.',
    category: 'HIGHLIGHTS',
    requirement: 'HIGHLIGHTS_UPLOADED',
    target: 1,
  },
  {
    name: 'Highlight Maker',
    description: 'Upload 50 highlights.',
    category: 'HIGHLIGHTS',
    requirement: 'HIGHLIGHTS_UPLOADED',
    target: 50,
  },
  {
    name: 'Social Player',
    description: 'Make 25 friends on GORA.',
    category: 'SOCIAL',
    requirement: 'FRIENDS',
    target: 25,
  },
  {
    name: 'Community Player',
    description: 'Play 5 different sports.',
    category: 'COMMUNITY',
    requirement: 'SPORTS_PARTICIPATED',
    target: 5,
  },
  {
    name: 'Storyteller',
    description: 'Post 50 stories from your games.',
    category: 'STORIES',
    requirement: 'STORIES_POSTED',
    target: 50,
  },
];
