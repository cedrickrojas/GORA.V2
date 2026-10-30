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
  { name: 'Esports', description: 'Competitive video games, team matches, and tournaments.' },
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
  { name: 'Torch Spark', description: 'Earn 10 GORA Points.', category: 'POINTS', requirement: 'GORA_POINTS', target: 10 },
  { name: 'First Flame', description: 'Earn 50 GORA Points.', category: 'POINTS', requirement: 'GORA_POINTS', target: 50 },
  { name: 'Burning Bright', description: 'Earn 150 GORA Points.', category: 'POINTS', requirement: 'GORA_POINTS', target: 150 },
  { name: 'Torchbearer', description: 'Earn 300 GORA Points.', category: 'POINTS', requirement: 'GORA_POINTS', target: 300 },
  { name: 'Eternal Flame', description: 'Earn 1,000 GORA Points.', category: 'POINTS', requirement: 'GORA_POINTS', target: 1000 },
  { name: 'Court Regular', description: 'Join 10 sports games.', category: 'GAMES', requirement: 'GAMES_JOINED', target: 10 },
  { name: 'First Team', description: 'Join 25 sports games.', category: 'GAMES', requirement: 'GAMES_JOINED', target: 25 },
  { name: 'Pickup Legend', description: 'Join 100 sports games.', category: 'GAMES', requirement: 'GAMES_JOINED', target: 100 },
  { name: 'Reliable Finisher', description: 'Complete your first sports game.', category: 'COMPLETION', requirement: 'GAMES_COMPLETED', target: 1 },
  { name: 'Consistent Player', description: 'Complete 25 sports games.', category: 'COMPLETION', requirement: 'GAMES_COMPLETED', target: 25 },
  { name: 'Century Club', description: 'Complete 100 sports games.', category: 'COMPLETION', requirement: 'GAMES_COMPLETED', target: 100 },
  { name: 'Iron Athlete', description: 'Complete 250 sports games.', category: 'COMPLETION', requirement: 'GAMES_COMPLETED', target: 250 },
  { name: 'Weekend Captain', description: 'Host 5 games for your community.', category: 'HOSTING', requirement: 'GAMES_HOSTED', target: 5 },
  { name: 'Community Captain', description: 'Host 10 games for your community.', category: 'HOSTING', requirement: 'GAMES_HOSTED', target: 10 },
  { name: 'League Builder', description: 'Host 50 games for your community.', category: 'HOSTING', requirement: 'GAMES_HOSTED', target: 50 },
  { name: 'Clip Collector', description: 'Upload 10 game highlights.', category: 'HIGHLIGHTS', requirement: 'HIGHLIGHTS_UPLOADED', target: 10 },
  { name: 'Highlight Pro', description: 'Upload 25 game highlights.', category: 'HIGHLIGHTS', requirement: 'HIGHLIGHTS_UPLOADED', target: 25 },
  { name: 'Highlight Legend', description: 'Upload 100 game highlights.', category: 'HIGHLIGHTS', requirement: 'HIGHLIGHTS_UPLOADED', target: 100 },
  { name: 'Story Starter', description: 'Post your first game story.', category: 'STORIES', requirement: 'STORIES_POSTED', target: 1 },
  { name: 'Game Day Reporter', description: 'Post 25 game stories.', category: 'STORIES', requirement: 'STORIES_POSTED', target: 25 },
  { name: 'Daily Storyteller', description: 'Post 100 game stories.', category: 'STORIES', requirement: 'STORIES_POSTED', target: 100 },
  { name: 'Friendly Face', description: 'Make your first friend on GORA.', category: 'SOCIAL', requirement: 'FRIENDS', target: 1 },
  { name: 'Team Networker', description: 'Make 100 friends on GORA.', category: 'SOCIAL', requirement: 'FRIENDS', target: 100 },
  { name: "Everyone's Teammate", description: 'Make 250 friends on GORA.', category: 'SOCIAL', requirement: 'FRIENDS', target: 250 },
  { name: 'Multi-Sport Athlete', description: 'Play 3 different sports.', category: 'COMMUNITY', requirement: 'SPORTS_PARTICIPATED', target: 3 },
  { name: 'All-Rounder', description: 'Play 7 different sports.', category: 'COMMUNITY', requirement: 'SPORTS_PARTICIPATED', target: 7 },
  { name: 'Sports Explorer', description: 'Play 10 different sports.', category: 'COMMUNITY', requirement: 'SPORTS_PARTICIPATED', target: 10 },
];
