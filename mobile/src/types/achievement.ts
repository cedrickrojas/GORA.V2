import type { ActivityMetric } from './activity';

export type BadgeCategory =
  | 'GAMES'
  | 'COMPLETION'
  | 'HOSTING'
  | 'HIGHLIGHTS'
  | 'STORIES'
  | 'SOCIAL'
  | 'COMMUNITY'
  | 'POINTS';

export type BadgeIcon =
  | 'flag'
  | 'people'
  | 'rocket'
  | 'flash'
  | 'trophy'
  | 'medal'
  | 'megaphone'
  | 'calendar'
  | 'videocam'
  | 'film'
  | 'book'
  | 'heart'
  | 'globe';

export interface BadgeRequirement {
  metric: ActivityMetric | 'goraPoints';
  text: string;
  unit: {
    singular: string;
    plural: string;
  };
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  category: BadgeCategory;
  requirement: BadgeRequirement;
  unlocked: boolean;
  progress: number;
  target: number;
}
