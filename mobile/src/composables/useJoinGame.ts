import { useGamesStore } from '@/stores/games';
import type { Game } from '@/types/game';
import { showNotice } from '@/utils/notice';

export function useJoinGame(): { joinGame: (game: Game) => Promise<void> } {
  const gamesStore = useGamesStore();

  async function joinGame(game: Game): Promise<void> {
    const sent = await gamesStore.requestToJoin(game.id);

    if (sent) {
      await showNotice(`Join request sent. ${game.host.displayName} needs to accept it.`);
    }
  }

  return { joinGame };
}
