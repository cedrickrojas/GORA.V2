export interface ActivityStats {
  gamesJoined: number;
  gamesCompleted: number;
  gamesHosted: number;
  highlightsUploaded: number;
  storiesPosted: number;
  friendsCount: number;
  sportsParticipated: number;
}

export type ActivityMetric = keyof ActivityStats;
