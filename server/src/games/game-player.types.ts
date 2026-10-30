import type { AttendanceStatus, GameLeaveStatus, GameStatus, ParticipantStatus } from '../generated/prisma/client';

/** Public profile fields only: never email, date of birth, or credentials. */
export interface GamePlayerView {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
  joinedAt: string;
  status: ParticipantStatus;
  attendanceStatus: AttendanceStatus | null;
}

/** ACTIVE players, oldest seat first. Open slots are requiredPlayers - currentPlayers. */
export interface GameRosterView {
  gameId: string;
  requiredPlayers: number;
  currentPlayers: number;
  availableSlots: number;
  status: GameStatus;
  players: GamePlayerView[];
}

export type MyParticipationStatus = ParticipantStatus | 'NOT_A_PLAYER';

export interface MyParticipationView {
  gameId: string;
  status: MyParticipationStatus;
  joinedAt: string | null;
  completedAt: string | null;
}

export interface GameLeaveRequestView {
  id: string;
  gameId: string;
  userId: string;
  status: GameLeaveStatus;
  createdAt: string;
  user?: Omit<GamePlayerView, 'status' | 'attendanceStatus'>;
}
