import type { UserSummary } from "./user";

export interface RankedPlayer extends UserSummary {
  goraPoints: number;
  rank: number;
}

export interface GoraRankingPage {
  players: RankedPlayer[];
  currentPlayer: RankedPlayer | null;
  total: number;
  nextOffset: number;
  hasMore: boolean;
}
