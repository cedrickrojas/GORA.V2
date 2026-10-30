import { useRouter } from 'vue-router';
import { actionSheetController, alertController } from '@ionic/vue';
import { chatbubblesOutline, createOutline } from 'ionicons/icons';
import { useChatStore } from '@/stores/chat';
import { showNotice } from '@/utils/notice';

export interface GameShareTarget {
  id: string;
  title: string;
  sport: string;
  locationName: string;
  when: string;
}

export function useGameShare() {
  const router = useRouter();
  const chatStore = useChatStore();

  async function shareGame(game: GameShareTarget): Promise<void> {
    const path = `/games/${encodeURIComponent(game.id)}`;
    const url = new URL(path, window.location.origin).href;
    const shareAsPost = () => router.push({
      path: '/create/post',
      query: {
        shareGame: game.id,
        gameTitle: game.title,
        gameSport: game.sport,
        gameLocation: game.locationName,
        gameWhen: game.when,
      },
    });

    async function shareToMessages(): Promise<void> {
      await chatStore.load();
      const conversations = chatStore.sortedConversations;
      if (conversations.length === 0) {
        void showNotice('Start a message conversation before sharing a game.');
        return;
      }

      const alert = await alertController.create({
        header: 'Share to messages',
        subHeader: 'Choose a conversation',
        inputs: conversations.slice(0, 20).map((conversation, index) => ({
          type: 'radio' as const,
          label: conversation.partner.displayName,
          value: conversation.id,
          checked: index === 0,
        })),
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Send',
            handler: async (conversationId: unknown) => {
              if (typeof conversationId !== 'string') return false;
              const error = await chatStore.sendMessage(
                conversationId,
                `Check out this ${game.sport} game on GORA: ${game.title}\n${game.locationName} · ${game.when}\n${url}`,
              );
              if (error) {
                void showNotice(error);
                return false;
              }
              void showNotice(`Game sent to ${chatStore.getConversation(conversationId)?.partner.displayName ?? 'messages'}.`);
              return true;
            },
          },
        ],
      });
      await alert.present();
    }

    const sheet = await actionSheetController.create({
      header: 'Share game',
      buttons: [
        { text: 'Share as post', icon: createOutline, handler: () => void shareAsPost() },
        { text: 'Share to messages', icon: chatbubblesOutline, handler: () => void shareToMessages() },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  return { shareGame };
}
