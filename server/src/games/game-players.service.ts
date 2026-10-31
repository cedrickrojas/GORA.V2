import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GameLeaveStatus, ParticipantStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoraPointsService } from '../gora-points/gora-points.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import { ACTIVE_PLAYER_STATUS, summarizeGameCapacity } from './game-capacity';
import {
  GAME_FACTS_SELECT,
  ROSTER_LOCKED_MESSAGES,
  lockGame,
  type GameFacts,
} from './game-roster';
import type { GameLeaveRequestView, GameRosterView, MyParticipationView } from './game-player.types';
import { visibleGamesWhere } from './game-visibility';
import { GAME_NOT_FOUND_MESSAGE } from './games.service';
import { successfulGamePoints } from './game-completion-points';

export const PLAYER_NOT_FOUND_MESSAGE = 'Player not found.';
export const NOT_A_PLAYER_MESSAGE = "You're not a player in this game.";
export const PLAYER_HOST_ONLY_MESSAGE =
  'Only the host can manage players in this game.';
export const HOST_SELF_REMOVE_MESSAGE =
  "You're the host; you can't remove yourself from your own game.";

const LEAVE_BLOCKED_MESSAGES: Record<
  Exclude<ParticipantStatus, 'ACTIVE'>,
  string
> = {
  LEFT: 'You already left this game.',
  REMOVED: 'The host removed you from this game.',
  COMPLETED: 'This game is already over.',
};

const REMOVE_BLOCKED_MESSAGES: Record<
  Exclude<ParticipantStatus, 'ACTIVE'>,
  string
> = {
  LEFT: 'This player already left the game.',
  REMOVED: 'This player was already removed.',
  COMPLETED: 'This game is already over.',
};

const PLAYER_SELECT = {
  joinedAt: true,
  status: true,
  attendanceStatus: true,
  user: { select: AUTHOR_SELECT },
} as const satisfies Prisma.GameParticipantSelect;

/**
 * The roster: ACTIVE GameParticipant rows, counted by the database, never stored. Leaving
 * (ACTIVE -> LEFT) and removal (ACTIVE -> REMOVED) keep the row as history and run in a
 * transaction that locks the game row. The GameParticipant_sync_recruiting_status trigger
 * then reopens a FULL game in the same transaction (FULL -> OPEN); it never touches
 * CANCELLED, ACTIVE, or COMPLETED games. Seating happens only by accepting a join request.
 */
@Injectable()
export class GamePlayersService {
  constructor(private readonly prisma: PrismaService, private readonly points: GoraPointsService) {}

  async roster(viewerId: string, gameId: string): Promise<GameRosterView> {
    await this.findVisibleGame(viewerId, gameId);
    return this.loadRoster(this.prisma, gameId);
  }

  async mine(viewerId: string, gameId: string): Promise<MyParticipationView> {
    await this.findVisibleGame(viewerId, gameId);
    return this.participation(viewerId, gameId);
  }

  /** Ask the host to approve leaving; a pending request does not release the seat. */
  async requestLeave(viewerId: string, gameId: string): Promise<GameLeaveRequestView> {
    return this.prisma.$transaction(async (tx) => {
      const game = await lockGame(tx, gameId);
      const row = await tx.gameParticipant.findUnique({
        where: { gameId_userId: { gameId, userId: viewerId } },
        select: { status: true },
      });

      if (!row) {
        throw new NotFoundException(NOT_A_PLAYER_MESSAGE);
      }

      if (row.status !== ACTIVE_PLAYER_STATUS) throw new ConflictException(LEAVE_BLOCKED_MESSAGES[row.status]);

      assertRosterUnlocked(game);

      const existing = await tx.gameLeaveRequest.findUnique({ where: { gameId_userId: { gameId, userId: viewerId } } });
      if (existing?.status === 'PENDING') return toLeaveRequestView(existing);

      const request = await tx.gameLeaveRequest.upsert({
        where: { gameId_userId: { gameId, userId: viewerId } },
        create: { gameId, userId: viewerId },
        update: { status: 'PENDING', respondedAt: null, createdAt: new Date() },
        select: { id: true, gameId: true, userId: true, status: true, createdAt: true },
      });
      await tx.notification.create({
        data: { userId: game.hostId, actorId: viewerId, type: 'GAME_LEAVE_REQUEST', gameId },
      });
      return toLeaveRequestView(request);
    });
  }

  async cancelLeaveRequest(viewerId: string, gameId: string): Promise<GameLeaveRequestView> {
    const request = await this.prisma.gameLeaveRequest.findUnique({ where: { gameId_userId: { gameId, userId: viewerId } } });
    if (!request || request.status !== 'PENDING') throw new ConflictException('There is no pending leave request to cancel.');
    const updated = await this.prisma.gameLeaveRequest.update({ where: { id: request.id }, data: { status: 'CANCELLED', respondedAt: new Date() } });
    return toLeaveRequestView(updated);
  }

  async myLeaveRequest(viewerId: string, gameId: string): Promise<GameLeaveRequestView | null> {
    const request = await this.prisma.gameLeaveRequest.findUnique({ where: { gameId_userId: { gameId, userId: viewerId } } });
    return request ? toLeaveRequestView(request) : null;
  }

  async hostLeaveRequests(hostId: string, gameId: string): Promise<GameLeaveRequestView[]> {
    const game = await this.findVisibleGame(hostId, gameId);
    if (game.hostId !== hostId) throw new ForbiddenException(PLAYER_HOST_ONLY_MESSAGE);
    const requests = await this.prisma.gameLeaveRequest.findMany({
      where: { gameId }, orderBy: [{ createdAt: 'desc' }],
      select: { id: true, gameId: true, userId: true, status: true, createdAt: true, user: { select: { ...AUTHOR_SELECT, id: true, username: true, firstName: true, lastName: true, profileImageUrl: true } } },
    });
    return requests.map((request) => ({ ...toLeaveRequestView(request), user: {
      id: request.user.id, username: request.user.username, firstName: request.user.firstName, lastName: request.user.lastName,
      displayName: formatDisplayName(request.user), profileImageUrl: request.user.profileImageUrl, joinedAt: request.createdAt.toISOString(),
    } }));
  }

  async respondLeaveRequest(hostId: string, gameId: string, userId: string, approve: boolean): Promise<GameLeaveRequestView> {
    const game = await this.findVisibleGame(hostId, gameId);
    if (game.hostId !== hostId) throw new ForbiddenException(PLAYER_HOST_ONLY_MESSAGE);
    return this.prisma.$transaction(async (tx) => {
      const locked = await lockGame(tx, gameId);
      assertRosterUnlocked(locked);
      const request = await tx.gameLeaveRequest.findUnique({ where: { gameId_userId: { gameId, userId } } });
      if (!request || request.status !== 'PENDING') throw new ConflictException('This leave request is no longer pending.');
      if (approve) {
        const { count } = await tx.gameParticipant.updateMany({ where: { gameId, userId, status: ACTIVE_PLAYER_STATUS }, data: { status: 'LEFT' } });
        if (!count) throw new ConflictException('This player is no longer active in the game.');
        await this.points.awardInTransaction(tx, userId, 'GAME_CANCELLED_PLAYER', request.id, -1);
      }
      const status: GameLeaveStatus = approve ? 'APPROVED' : 'REJECTED';
      const updated = await tx.gameLeaveRequest.update({ where: { id: request.id }, data: { status, respondedAt: new Date() } });
      await tx.notification.create({ data: { userId, actorId: hostId, type: approve ? 'GAME_LEAVE_APPROVED' : 'GAME_LEAVE_REJECTED', gameId } });
      return toLeaveRequestView(updated);
    });
  }

  async remove(
    hostId: string,
    gameId: string,
    userId: string,
  ): Promise<GameRosterView> {
    const game = await this.findVisibleGame(hostId, gameId);

    if (game.hostId !== hostId) {
      throw new ForbiddenException(PLAYER_HOST_ONLY_MESSAGE);
    }

    if (userId === hostId) {
      throw new BadRequestException(HOST_SELF_REMOVE_MESSAGE);
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await lockGame(tx, gameId);
      const row = await tx.gameParticipant.findUnique({
        where: { gameId_userId: { gameId, userId } },
        select: { status: true },
      });

      if (!row) {
        throw new NotFoundException(PLAYER_NOT_FOUND_MESSAGE);
      }

      if (row.status !== ACTIVE_PLAYER_STATUS) {
        throw new ConflictException(REMOVE_BLOCKED_MESSAGES[row.status]);
      }

      assertRosterUnlocked(locked);

      const { count } = await tx.gameParticipant.updateMany({
        where: { gameId, userId, status: ACTIVE_PLAYER_STATUS },
        data: { status: 'REMOVED' },
      });

      if (count === 0) {
        throw new ConflictException(REMOVE_BLOCKED_MESSAGES.LEFT);
      }

      return this.loadRoster(tx, gameId);
    });
  }

  async markAttendance(hostId: string, gameId: string, userId: string, attended: boolean): Promise<GameRosterView> {
    const game = await this.findVisibleGame(hostId, gameId);
    if (game.hostId !== hostId) throw new ForbiddenException(PLAYER_HOST_ONLY_MESSAGE);
    if (game.status !== 'COMPLETED') throw new ConflictException('Attendance can be confirmed after the game is completed.');

    return this.prisma.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      const participant = await tx.gameParticipant.findUnique({
        where: { gameId_userId: { gameId, userId } },
        select: { id: true, status: true, attendanceStatus: true },
      });
      if (!participant || participant.status !== 'COMPLETED') throw new NotFoundException(PLAYER_NOT_FOUND_MESSAGE);
      if (participant.attendanceStatus) throw new ConflictException('Attendance has already been reviewed.');

      const attendanceStatus = attended ? 'ATTENDED' : 'NO_SHOW';
      const updated = await tx.gameParticipant.updateMany({
        where: { id: participant.id, attendanceStatus: null },
        data: { attendanceStatus },
      });
      if (!updated.count) throw new ConflictException('Attendance has already been reviewed.');

      if (attended) {
        await this.points.awardInTransaction(
          tx,
          userId,
          'GAME_COMPLETED_PLAYER',
          gameId,
          successfulGamePoints(game.requiredPlayers),
        );
      } else {
        await this.points.awardInTransaction(tx, userId, 'GAME_NO_SHOW_PLAYER', participant.id, -2);
      }
      await tx.notification.create({
        data: { userId, actorId: hostId, type: attended ? 'GAME_ATTENDANCE_CONFIRMED' : 'GAME_NO_SHOW_REPORTED', gameId },
      });
      return this.loadRoster(tx, gameId);
    });
  }

  private async participation(
    userId: string,
    gameId: string,
  ): Promise<MyParticipationView> {
    const row = await this.prisma.gameParticipant.findUnique({
      where: { gameId_userId: { gameId, userId } },
      select: { status: true, joinedAt: true, completedAt: true },
    });

    return {
      gameId,
      status: row?.status ?? 'NOT_A_PLAYER',
      joinedAt: row?.joinedAt.toISOString() ?? null,
      completedAt: row?.completedAt?.toISOString() ?? null,
    };
  }

  private async loadRoster(
    client: Prisma.TransactionClient,
    gameId: string,
  ): Promise<GameRosterView> {
    const game = await client.game.findUniqueOrThrow({
      where: { id: gameId },
      select: { id: true, requiredPlayers: true, status: true },
    });
    const rows = await client.gameParticipant.findMany({
      where: { gameId, status: game.status === 'COMPLETED' ? 'COMPLETED' : ACTIVE_PLAYER_STATUS },
      select: PLAYER_SELECT,
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    });
    const capacity = summarizeGameCapacity(game.requiredPlayers, rows.length);

    return {
      gameId: game.id,
      requiredPlayers: capacity.requiredPlayers,
      currentPlayers: capacity.currentPlayers,
      availableSlots: capacity.remainingSlots,
      status: game.status,
      players: rows.slice(0, capacity.requiredPlayers).map((row) => ({
        id: row.user.id,
        username: row.user.username,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        displayName: formatDisplayName(row.user),
        profileImageUrl: row.user.profileImageUrl,
        joinedAt: row.joinedAt.toISOString(),
        status: row.status,
        attendanceStatus: row.attendanceStatus,
      })),
    };
  }

  private async findVisibleGame(
    viewerId: string,
    gameId: string,
  ): Promise<GameFacts> {
    const game = await this.prisma.game.findFirst({
      where: { AND: [{ id: gameId }, visibleGamesWhere(viewerId)] },
      select: GAME_FACTS_SELECT,
    });

    if (!game) {
      throw new NotFoundException(GAME_NOT_FOUND_MESSAGE);
    }

    return game;
  }
}

function assertRosterUnlocked(game: GameFacts): void {
  const message = ROSTER_LOCKED_MESSAGES[game.status];

  if (message) {
    throw new ConflictException(message);
  }
}

function toLeaveRequestView(request: {
  id: string; gameId: string; userId: string; status: GameLeaveStatus; createdAt: Date;
}): GameLeaveRequestView {
  return { id: request.id, gameId: request.gameId, userId: request.userId, status: request.status, createdAt: request.createdAt.toISOString() };
}
