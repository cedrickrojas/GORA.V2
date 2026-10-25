import { onMounted, onUnmounted, ref, type Ref } from 'vue';

/** Reactive clock so time-based UI (such as story expiry) updates on its own. */
export function useNow(intervalMs = 60_000): Ref<number> {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now();
    }, intervalMs);
  });

  onUnmounted(() => {
    clearInterval(timer);
  });

  return now;
}
