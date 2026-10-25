import { onMounted, onUnmounted, watch } from "vue";
import { useNotificationsStore } from "@/stores/notifications";
import { useAuthStore } from "@/stores/auth";

/** One poller for the authenticated layout, shared by the desktop and mobile bells. */
export function useNotificationPolling(): void {
  const notifications = useNotificationsStore();
  const auth = useAuthStore();
  let mounted = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const refresh = () => {
    if (auth.accessToken && !document.hidden) void notifications.load(true);
  };
  watch(
    () => [auth.sessionVersion, auth.currentUser?.id, auth.accessToken],
    () => {
      if (mounted) refresh();
    },
  );
  onMounted(() => {
    mounted = true;
    refresh();
    timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
  });
  onUnmounted(() => {
    mounted = false;
    clearInterval(timer);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  });
}
