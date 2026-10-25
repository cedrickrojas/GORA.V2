import {
  calendarOutline,
  checkmarkDoneOutline,
  filmOutline,
  flagOutline,
  globeOutline,
  megaphoneOutline,
  peopleOutline,
} from 'ionicons/icons';
import type { ActivityMetric, ActivityStats } from '@/types/activity';

export interface ActivityStatDefinition {
  metric: ActivityMetric;
  label: string;
  icon: string;
}

export interface ActivityStatItem extends ActivityStatDefinition {
  value: number;
}

export const ACTIVITY_STAT_DEFINITIONS: readonly ActivityStatDefinition[] = [
  { metric: 'gamesJoined', label: 'Games Joined', icon: flagOutline },
  { metric: 'gamesCompleted', label: 'Games Completed', icon: checkmarkDoneOutline },
  { metric: 'gamesHosted', label: 'Games Hosted', icon: calendarOutline },
  { metric: 'highlightsUploaded', label: 'Highlights Uploaded', icon: filmOutline },
  { metric: 'storiesPosted', label: 'Stories Posted', icon: megaphoneOutline },
  { metric: 'friendsCount', label: 'Friends', icon: peopleOutline },
  { metric: 'sportsParticipated', label: 'Sports Participated', icon: globeOutline },
];

export function toActivityStatItems(stats: ActivityStats): ActivityStatItem[] {
  return ACTIVITY_STAT_DEFINITIONS.map((definition) => ({
    ...definition,
    value: stats[definition.metric],
  }));
}
