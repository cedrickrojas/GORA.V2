import { actionSheetController } from '@ionic/vue';
import { calendarOutline, createOutline, radioOutline, sparklesOutline, videocamOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';

export type CreateActionId = 'POST' | 'GAME' | 'REEL' | 'STORY' | 'LIVE';

export interface CreateAction {
  id: CreateActionId;
  label: string;
  icon: string;
  route: string;
}

export const CREATE_ACTIONS: readonly CreateAction[] = [
  { id: 'POST', label: 'Create Post', icon: createOutline, route: '/create/post' },
  { id: 'GAME', label: 'Create Game', icon: calendarOutline, route: '/create/game' },
  { id: 'REEL', label: 'Upload Reel', icon: videocamOutline, route: '/create/reel' },
  { id: 'STORY', label: 'Add Story', icon: sparklesOutline, route: '/create/story' },
  { id: 'LIVE', label: 'Go Live', icon: radioOutline, route: '/create/live' },
];

export function useCreateMenu(): {
  openCreateMenu: () => Promise<void>;
  runCreateAction: (action: CreateAction) => void;
} {
  const router = useRouter();

  function runCreateAction(action: CreateAction): void {
    void router.push(action.route);
  }

  async function openCreateMenu(): Promise<void> {
    const sheet = await actionSheetController.create({
      header: 'Create',
      cssClass: 'gora-sheet',
      buttons: [
        ...CREATE_ACTIONS.map((action) => ({
          text: action.label,
          icon: action.icon,
          handler: () => {
            runCreateAction(action);
          },
        })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });

    await sheet.present();
  }

  return { openCreateMenu, runCreateAction };
}
