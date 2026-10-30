import { type Ref, computed, ref } from 'vue';
import { useJoinRequestsStore } from '@/stores/join-requests';
import { useGamesStore } from '@/stores/games';
import type { ApiGame } from '@/types/game';
import type { JoinRequestStatus } from '@/types/join-request';
import type { DiscoveredGame } from '@/types/discovery';
import { discoveryJoinAction } from '@/utils/discovery-display';
import type { JoinRequestAction } from '@/utils/join-requests';
import { showNotice } from '@/utils/notice';

/**
 * Request to Join from a map preview or list row, through the existing join request flow
 * (JoinRequestModal -> POST /games/:id/join-requests). The server re-checks every rule.
 */
export function useDiscoveryJoin(
  games: Ref<readonly DiscoveredGame[]>,
  onSent: (gameId: string, status: JoinRequestStatus, game: ApiGame | null) => void,
) {
  const joinRequests = useJoinRequestsStore();
  const gamesStore = useGamesStore();
  const joiningGameId = ref<string | null>(null);
  const joinError = ref<string | null>(null);

  const joiningGame = computed(() => games.value.find((game) => game.id === joiningGameId.value) ?? null);
  const busyGameId = computed(() => joinRequests.submittingGameId);

  function joinActionOf(game: DiscoveredGame): JoinRequestAction {
    const mine = game.id in joinRequests.mineByGame ? joinRequests.mineByGame[game.id] : undefined;
    return discoveryJoinAction(game, mine);
  }

  function openJoin(gameId: string): void {
    joinError.value = null;
    joiningGameId.value = gameId;
  }

  function closeJoin(): void {
    joiningGameId.value = null;
    joinError.value = null;
  }

  async function sendJoin(message: string | null): Promise<void> {
    const gameId = joiningGameId.value;

    if (!gameId) {
      return;
    }

    const result = await joinRequests.createJoinRequest(gameId, message);

    if (result.ok) {
      const status = joinRequests.myJoinRequest(gameId)?.status ?? 'PENDING';
      onSent(gameId, status, status === 'ACCEPTED' ? gamesStore.gameById(gameId) : null);
      closeJoin();
      void showNotice(
        joinRequests.myJoinRequest(gameId)?.status === 'ACCEPTED'
          ? 'You joined the game. Your slot is confirmed.'
          : 'Join request sent.',
      );
    } else {
      joinError.value = result.message;
    }
  }

  return { joiningGame, joinError, busyGameId, joinActionOf, openJoin, closeJoin, sendJoin };
}
