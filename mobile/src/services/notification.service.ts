import type { NotificationsPage } from "@/types/notification";
import { apiRequest } from "./api-client";

export function fetchNotifications(
  token: string,
  offset = 0,
): Promise<NotificationsPage> {
  return apiRequest<NotificationsPage>(
    `/notifications?limit=40&offset=${offset}`,
    { token },
  );
}

export function markNotificationRead(
  token: string,
  id: string,
): Promise<{ id: string; read: boolean; unreadCount: number }> {
  return apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    token,
  });
}

export function markAllNotificationsRead(
  token: string,
): Promise<{ updated: number; unreadCount: number }> {
  return apiRequest("/notifications/read-all", { method: "PATCH", token });
}
