import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ParticipantStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import { ACTIVE_PLAYER_STATUS, summarizeGameCapacity } from './game-capacity';
import {
  GAME_FACTS_SELECT,
  ROSTER_LOCKED_MESSAGES,
  lockGame,
  type GameFacts,
} from './game-roster';
import type { GameRosterView, MyParticipationView } from './game-player.types';
import { visibleGamesWhere } from './game-visibility';
import { GAME_NOT_FOUND_MESSAGE } from './games.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async roster(viewerId: string, gameId: string): Promise<GameRosterView> {
    await this.findVisibleGame(viewerId, gameId);
    return this.loadRoster(this.prisma, gameId);
  }

  async mine(viewerId: string, gameId: string): Promise<MyParticipationView> {
    await this.findVisibleGame(viewerId, gameId);
    return this.participation(viewerId, gameId);
  }

  /** Only the player's own row; the game does not need to be visible to leave it. */
  async leave(viewerId: string, gameId: string): Promise<MyParticipationView> {
    await this.prisma.$transaction(async (tx) => {
      const game = await lockGame(tx, gameId);
      const row = await tx.gameParticipant.findUnique({
        where: { gameId_userId: { gameId, userId: viewerId } },
        select: { status: true },
      });

      if (!row) {
        throw new NotFoundException(NOT_A_PLAYER_MESSAGE);
      }

      if (row.status !== ACTIVE_PLAYER_STATUS) {
        throw new ConflictException(LEAVE_BLOCKED_MESSAGES[row.status]);
      }

      assertRosterUnlocked(game);

      const { count } = await tx.gameParticipant.updateMany({
        where: { gameId, userId: viewerId, status: ACTIVE_PLAYER_STATUS },
        data: { status: 'LEFT' },
      });

      if (count === 0) {
        throw new ConflictException(LEAVE_BLOCKED_MESSAGES.LEFT);
      }
    });

    return this.participation(viewerId, gameId);
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
      where: { gameId, status: ACTIVE_PLAYER_STATUS },
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
