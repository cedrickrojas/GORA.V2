import type { GoraRankingPage } from "@/types/gora-ranking";
import { apiRequest } from "./api-client";

export function fetchGoraRanking(
  token: string,
  offset = 0,
): Promise<GoraRankingPage> {
  return apiRequest(`/gora-points/ranking?limit=10&offset=${offset}`, {
    token,
  });
}
