import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue';

type ChatPage = HTMLElement | { $el: HTMLElement };

/** Resize the whole thread, rather than covering messages with a floating composer. */
export function useChatKeyboard(page: Ref<ChatPage | null>, onResize: () => void) {
  const keyboardInset = ref(0);
  let listening = false;
  let frame = 0;
  let viewport: VisualViewport | null = null;

  function measure(): void {
    frame = 0;
    const element = page.value instanceof HTMLElement ? page.value : page.value?.$el;
    if (!element || element.classList.contains('ion-page-hidden')) return;
    const rect = element.getBoundingClientRect();
    if (!rect.height) return;
    // Pinch zoom must remain available; it is not an on-screen keyboard.
    const visibleBottom = viewport && Math.abs(viewport.scale - 1) < 0.05
      ? viewport.offsetTop + viewport.height
      : window.innerHeight;
    const inset = Math.max(0, Math.round(rect.bottom + keyboardInset.value - visibleBottom));
    const next = Math.min(inset, Math.max(0, rect.height + keyboardInset.value - 120));
    if (next !== keyboardInset.value) {
      keyboardInset.value = next;
      onResize();
    }
  }

  function schedule(): void {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  function start(): void {
    if (listening) return;
    listening = true;
    viewport = window.visualViewport;
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    schedule();
  }

  function stop(): void {
    listening = false;
    cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    keyboardInset.value = 0;
  }

  onMounted(start);
  onIonViewWillEnter(start);
  onIonViewDidLeave(stop);
  onBeforeUnmount(stop);
  return { keyboardInset };
}
