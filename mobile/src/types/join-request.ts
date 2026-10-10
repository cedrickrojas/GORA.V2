export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

/** A request to join a GORA game. The requester and host always come from the server. */
export interface JoinRequest {
  id: string;
  gameId: string;
  userId: string;
  message: string | null;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
}

/** Public profile fields of the requester, as the host sees them. */
export interface JoinRequestRequester {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface HostJoinRequest extends JoinRequest {
  user: JoinRequestRequester;
}
