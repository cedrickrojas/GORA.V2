import type { JoinRequestStatus } from '../generated/prisma/client';

export interface JoinRequestView {
  id: string;
  gameId: string;
  userId: string;
  message: string | null;
  status: JoinRequestStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
}

/** Public profile fields only: never email, date of birth, or credentials. */
export interface JoinRequestRequester {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
}

/** What the host sees for each request on their game. */
export interface HostJoinRequestView extends JoinRequestView {
  user: JoinRequestRequester;
}
