import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue';
import { KEYBOARD_VIEWPORT_EVENT } from '@/utils/keyboard-viewport';

type ChatPage = HTMLElement | { $el: HTMLElement };

/** The app handles resizing once; visible threads only keep their latest messages in view. */
export function useChatKeyboard(page: Ref<ChatPage | null>, onResize: () => void) {
  let listening = false;
  function resized(event: Event): void {
    const element = page.value instanceof HTMLElement ? page.value : page.value?.$el;
    if (!element || element.classList.contains('ion-page-hidden')) return;
    const input = (event as CustomEvent<{ input: HTMLElement }>).detail.input;
    if (element.contains(input) && input.closest('ion-footer')) onResize();
  }

  function start(): void {
    if (listening) return;
    listening = true;
    document.addEventListener(KEYBOARD_VIEWPORT_EVENT, resized);
  }

  function stop(): void {
    listening = false;
    document.removeEventListener(KEYBOARD_VIEWPORT_EVENT, resized);
  }

  onMounted(start);
  onIonViewWillEnter(start);
  onIonViewDidLeave(stop);
  onBeforeUnmount(stop);
}
