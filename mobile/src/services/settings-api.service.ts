import type { UserSettings } from '@/types/user-settings';
import { apiRequest } from './api-client';

export function getMySettings(token: string): Promise<UserSettings> {
  return apiRequest<UserSettings>('/profiles/me/settings', { token });
}

export function updateMySettings(token: string, changes: Partial<UserSettings>): Promise<UserSettings> {
  return apiRequest<UserSettings>('/profiles/me/settings', { method: 'PATCH', body: changes, token });
}
