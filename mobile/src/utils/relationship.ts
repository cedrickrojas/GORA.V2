import type { FriendRequestDirection } from '@/types/friend';

/**
 * Mirrors the server's RelationshipState (GET /users/:username/relationship). BLOCKED_BY_THEM
 * never reaches the client: the API answers 404, so that profile simply does not exist.
 */
export type RelationshipState = 'SELF' | 'NO_RELATIONSHIP' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS' | 'BLOCKED';

/** DIRECT opens the conversation, REQUEST sends a message request, NONE allows nothing. */
export type MessageAccess = 'DIRECT' | 'REQUEST' | 'NONE';

export type ProfileAction = 'ADD_FRIEND' | 'REQUEST_SENT' | 'ACCEPT' | 'DELETE' | 'FRIENDS' | 'MESSAGE' | 'UNBLOCK';

export interface RelationshipFacts {
  friendIds: ReadonlySet<string>;
  /** Users the viewer blocked. */
  blockedIds: ReadonlySet<string>;
  /** The pending friend request between the two, if any, from the viewer's side. */
  requestDirection: FriendRequestDirection | null;
}

export function resolveRelationship(viewerId: string, targetId: string, facts: RelationshipFacts): RelationshipState {
  if (viewerId === targetId) {
    return 'SELF';
  }

  if (facts.blockedIds.has(targetId)) {
    return 'BLOCKED';
  }

  if (facts.friendIds.has(targetId)) {
    return 'FRIENDS';
  }

  if (facts.requestDirection === 'SENT') {
    return 'REQUEST_SENT';
  }

  if (facts.requestDirection === 'RECEIVED') {
    return 'REQUEST_RECEIVED';
  }

  return 'NO_RELATIONSHIP';
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
      return 'NONE';
  }
}

/** The buttons on another user's profile, in order. Never hard-coded in the page. */
export function profileActionsFor(state: RelationshipState): ProfileAction[] {
  switch (state) {
    case 'NO_RELATIONSHIP':
      return ['ADD_FRIEND', 'MESSAGE'];
    case 'REQUEST_SENT':
      return ['REQUEST_SENT', 'MESSAGE'];
    case 'REQUEST_RECEIVED':
      return ['ACCEPT', 'DELETE'];
    case 'FRIENDS':
      return ['FRIENDS', 'MESSAGE'];
    case 'BLOCKED':
      return ['UNBLOCK'];
    case 'SELF':
      return [];
  }
}
