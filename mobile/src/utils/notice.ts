import { toastController } from '@ionic/vue';

export async function showNotice(message: string): Promise<void> {
  const toast = await toastController.create({ message, duration: 2200, position: 'bottom' });

  await toast.present();
}

export function showLaterPhaseNotice(feature: string): Promise<void> {
  return showNotice(`${feature} arrives in a later phase.`);
}
