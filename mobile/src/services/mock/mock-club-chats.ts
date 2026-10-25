import type { ClubChatMessage } from '@/types/chat';
import type { UserSummary } from '@/types/user';
import { MINUTE_MS } from '@/utils/time';
import { mockClubSummaries } from './mock-clubs';
import { mockCurrentUser, mockUsers } from './mock-users';

type MessageSeed = [sender: UserSummary, content: string, minutesAgo: number];

/** Demo history for the official chats of the demo clubs the demo user belongs to. */
const MESSAGE_SEEDS: Record<string, MessageSeed[]> = {
  [mockClubSummaries.imusVolleyball.id]: [
    [mockUsers.maria, 'Court is booked for Thursday, 6 PM to 9 PM.', 26 * 60],
    [mockCurrentUser, 'Newcomers welcome as always. Bring water!', 25 * 60],
    [mockUsers.carlo, 'Training starts at 6 PM today.', 95],
    [mockUsers.kim, "I'll be there.", 60],
    [mockUsers.bea, 'See you guys!', 14],
  ],
  [mockClubSummaries.caviteBasketball.id]: [
    [mockUsers.john, 'Weekend league sign-ups close Friday.', 2 * 24 * 60],
    [mockUsers.mark, 'Bacoor court is open Saturday morning for pickup.', 5 * 60],
  ],
};

/** Messages from others the demo user has not read yet, per club. */
export const MOCK_CLUB_CHAT_UNREAD: Record<string, number> = {
  [mockClubSummaries.imusVolleyball.id]: 2,
  [mockClubSummaries.caviteBasketball.id]: 1,
};

export function buildMockClubChatMessages(referenceMs: number): Record<string, ClubChatMessage[]> {
  return Object.fromEntries(
    Object.entries(MESSAGE_SEEDS).map(([clubId, seeds]) => [
      clubId,
      seeds.map(([sender, content, minutesAgo], index) => ({
        id: `${clubId}-message-${index + 1}`,
        conversationId: `${clubId}-chat`,
        sender,
        content,
        createdAt: new Date(referenceMs - minutesAgo * MINUTE_MS).toISOString(),
      })),
    ]),
  );
}
