import type { FriendshipStatus } from '../generated/prisma/client';

/**
 * The viewer's relationship to another user, which decides the profile buttons:
 * NO_RELATIONSHIP [Add Friend][Message], REQUEST_SENT [Request Sent][Message],
 * REQUEST_RECEIVED [Accept][Delete], FRIENDS [Friends][Message], BLOCKED [Unblock].
 * BLOCKED_BY_THEM is never sent to the client; the API answers 404 instead.
 */
export type RelationshipState =
  | 'SELF'
  | 'NO_RELATIONSHIP'
  | 'REQUEST_SENT'
  | 'REQUEST_RECEIVED'
  | 'FRIENDS'
  | 'BLOCKED'
  | 'BLOCKED_BY_THEM';

/** DIRECT opens the conversation, REQUEST sends a message request, NONE allows nothing. */
export type MessageAccess = 'DIRECT' | 'REQUEST' | 'NONE';

export interface FriendshipFacts {
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  blockedById: string | null;
}

/** The unique key of a pair of users, in either direction (Friendship.pairKey, MessageRequest.pairKey). */
export function toPairKey(userA: string, userB: string): string {
  return [userA, userB].sort().join(':');
}

export function resolveRelationship(
  viewerId: string,
  targetId: string,
  friendship: FriendshipFacts | null,
): RelationshipState {
  if (viewerId === targetId) {
    return 'SELF';
  }

  if (!friendship) {
    return 'NO_RELATIONSHIP';
  }

  switch (friendship.status) {
    case 'ACCEPTED':
      return 'FRIENDS';
    case 'PENDING':
      return friendship.requesterId === viewerId
        ? 'REQUEST_SENT'
        : 'REQUEST_RECEIVED';
    case 'BLOCKED':
      return friendship.blockedById === viewerId
        ? 'BLOCKED'
        : 'BLOCKED_BY_THEM';
    case 'REJECTED':
      return 'NO_RELATIONSHIP';
  }
}

export function messageAccessFor(state: RelationshipState): MessageAccess {
  switch (state) {
    case 'FRIENDS':
      return 'DIRECT';
    case 'NO_RELATIONSHIP':
    case 'REQUEST_SENT':
    case 'REQUEST_RECEIVED':
      return 'REQUEST';
    case 'SELF':
    case 'BLOCKED':
    case 'BLOCKED_BY_THEM':
      return 'NONE';
  }
}

export function canSendFriendRequest(state: RelationshipState): boolean {
  return state === 'NO_RELATIONSHIP';
}
