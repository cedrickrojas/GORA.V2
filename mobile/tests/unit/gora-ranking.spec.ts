import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { fetchGoraRanking } from "@/services/gora-ranking.service";
import { useGoraRankingStore } from "@/stores/gora-ranking";
import { useAuthStore } from "@/stores/auth";
import type { GoraRankingPage, RankedPlayer } from "@/types/gora-ranking";

vi.mock("@/services/gora-ranking.service", () => ({
  fetchGoraRanking: vi.fn(),
}));
const fetchPage = vi.mocked(fetchGoraRanking);
const player = (id: string, points = 10): RankedPlayer => ({
  id,
  username: id,
  displayName: id,
  avatarUrl: null,
  goraPoints: points,
  rank: 1,
});
const page = (
  players: RankedPlayer[],
  currentPlayer = player("me"),
): GoraRankingPage => ({
  players,
  currentPlayer,
  total: 12,
  nextOffset: players.length,
  hasMore: true,
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  useAuthStore().accessToken = "account-one";
});

describe("GORA ranking requests", () => {
  it("loads real scores, paginates without duplicates and refreshes from the first page", async () => {
    const ranking = useGoraRankingStore();
    fetchPage.mockResolvedValueOnce(page([player("a"), player("b")]));
    await ranking.load();
    fetchPage.mockResolvedValueOnce({
      ...page([player("b"), player("c")]),
      nextOffset: 4,
      hasMore: false,
    });
    await ranking.loadMore();
    expect(fetchPage).toHaveBeenLastCalledWith("account-one", 2);
    expect(ranking.players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(ranking.hasMore).toBe(false);
    fetchPage.mockResolvedValueOnce(page([player("a", 20)]));
    await ranking.load(true);
    expect(fetchPage).toHaveBeenLastCalledWith("account-one", 0);
    expect(ranking.players).toEqual([player("a", 20)]);
  });

  it("clears personalized results on account change and discards late responses", async () => {
    const ranking = useGoraRankingStore();
    let resolve!: (value: GoraRankingPage) => void;
    fetchPage.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = ranking.load();
    useAuthStore().accessToken = "account-two";
    await nextTick();
    resolve(page([player("private-to-first-account")]));
    await pending;
    expect(ranking.players).toEqual([]);
    expect(ranking.currentPlayer).toBeNull();
    fetchPage.mockResolvedValueOnce(page([player("second-account-result")]));
    await ranking.load();
    expect(fetchPage).toHaveBeenLastCalledWith("account-two", 0);
    expect(ranking.players[0].id).toBe("second-account-result");
  });

  it("keeps loaded rows on a failed page and can retry with a fresh load", async () => {
    const ranking = useGoraRankingStore();
    fetchPage.mockResolvedValueOnce(page([player("a")]));
    await ranking.load();
    fetchPage.mockRejectedValueOnce(new Error("offline"));
    await ranking.loadMore();
    expect(ranking.error).toBeTruthy();
    expect(ranking.players[0].id).toBe("a");
    fetchPage.mockResolvedValueOnce(page([player("b")]));
    await ranking.load(true);
    expect(ranking.error).toBeNull();
    expect(ranking.players[0].id).toBe("b");
  });
});
