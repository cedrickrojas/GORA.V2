import type { AppNotification } from '@/types/notification';
import { buildMockNotifications } from './mock/mock-notifications';

export async function fetchNotifications(): Promise<AppNotification[]> {
  return buildMockNotifications(Date.now());
}
