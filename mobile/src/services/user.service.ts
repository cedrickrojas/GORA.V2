import type { UserSummary } from '@/types/user';
import { mockCurrentUser } from './mock/mock-users';

export async function fetchCurrentUser(): Promise<UserSummary> {
  return { ...mockCurrentUser };
}
