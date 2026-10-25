import {
  canSendFriendRequest,
  messageAccessFor,
  resolveRelationship,
  toPairKey,
  type FriendshipFacts,
} from './relationship';

const ME = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEM = 'bbbbbbbb-0000-4000-8000-000000000002';

function friendship(overrides: Partial<FriendshipFacts>): FriendshipFacts {
  return {
    requesterId: ME,
    receiverId: THEM,
    status: 'PENDING',
    blockedById: null,
    ...overrides,
  };
}

describe('relationship', () => {
  it('builds the same pair key in either direction', () => {
    expect(toPairKey(ME, THEM)).toBe(toPairKey(THEM, ME));
    expect(toPairKey(THEM, ME)).toBe(`${ME}:${THEM}`);
  });

  it('resolves every friendship state from the viewer side', () => {
    expect(resolveRelationship(ME, ME, null)).toBe('SELF');
    expect(resolveRelationship(ME, THEM, null)).toBe('NO_RELATIONSHIP');
    expect(resolveRelationship(ME, THEM, friendship({}))).toBe('REQUEST_SENT');
    expect(resolveRelationship(THEM, ME, friendship({}))).toBe(
      'REQUEST_RECEIVED',
    );
    expect(
      resolveRelationship(ME, THEM, friendship({ status: 'ACCEPTED' })),
    ).toBe('FRIENDS');
    expect(
      resolveRelationship(ME, THEM, friendship({ status: 'REJECTED' })),
    ).toBe('NO_RELATIONSHIP');

    const blockedByMe = friendship({ status: 'BLOCKED', blockedById: ME });
    expect(resolveRelationship(ME, THEM, blockedByMe)).toBe('BLOCKED');
    expect(resolveRelationship(THEM, ME, blockedByMe)).toBe('BLOCKED_BY_THEM');
  });

  it('only allows a friend request with no relationship', () => {
    expect(canSendFriendRequest('NO_RELATIONSHIP')).toBe(true);
    for (const state of [
      'SELF',
      'REQUEST_SENT',
      'REQUEST_RECEIVED',
      'FRIENDS',
      'BLOCKED',
      'BLOCKED_BY_THEM',
    ] as const) {
      expect(canSendFriendRequest(state)).toBe(false);
    }
  });

  it('opens chats for friends, requests for others, nothing when blocked', () => {
    expect(messageAccessFor('FRIENDS')).toBe('DIRECT');
    expect(messageAccessFor('NO_RELATIONSHIP')).toBe('REQUEST');
    expect(messageAccessFor('REQUEST_SENT')).toBe('REQUEST');
    expect(messageAccessFor('REQUEST_RECEIVED')).toBe('REQUEST');
    expect(messageAccessFor('BLOCKED')).toBe('NONE');
    expect(messageAccessFor('BLOCKED_BY_THEM')).toBe('NONE');
    expect(messageAccessFor('SELF')).toBe('NONE');
  });
});
