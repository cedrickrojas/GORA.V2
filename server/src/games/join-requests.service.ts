import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import type { GameStatus, JoinRequestStatus } from '../generated/prisma/client';
import { readGameTimezone } from '../config/env.validation';
import { friendshipWithViewer } from '../posts/post-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import type { CreateJoinRequestDto } from './dto/join-request.dto';
import { ACTIVE_PLAYER_STATUS } from './game-capacity';
import {
  GAME_FACTS_SELECT,
  GAME_FULL_MESSAGE,
  countSeatedPlayers,
  lockGame,
  withCapacityGuard,
  type GameFacts,
} from './game-roster';
import { hasGameStarted, localMoment } from './game-schedule';
import { visibleGamesWhere } from './game-visibility';
import { GAME_NOT_FOUND_MESSAGE } from './games.service';
import type {
  HostJoinRequestView,
  JoinRequestView,
} from './join-request.types';

export const JOIN_REQUEST_NOT_FOUND_MESSAGE = 'Join request not found.';
export const JOIN_REQUEST_HOST_ONLY_MESSAGE =
  'Only the host can manage join requests for this game.';
export const JOIN_REQUEST_OWN_GAME_MESSAGE =
  "You're hosting this game, so you don't need to request to join.";
export const JOIN_REQUEST_DUPLICATE_MESSAGE =
  'You already asked to join this game.';
export const JOIN_REQUEST_REQUESTER_UNAVAILABLE_MESSAGE =
  'This player can no longer join this game.';

/** Why a game that is not OPEN takes no new requests and no acceptances. */
const CLOSED_GAME_MESSAGES: Record<Exclude<GameStatus, 'OPEN'>, string> = {
  FULL: GAME_FULL_MESSAGE,
  ACTIVE: 'This game has already started.',
  COMPLETED: 'This game is already over.',
  CANCELLED: 'This game was cancelled.',
};

/** Why a request that already left PENDING cannot move again. */
const SETTLED_REQUEST_MESSAGES: Record<
  Exclude<JoinRequestStatus, 'PENDING'>,
  string
> = {
  ACCEPTED: 'This request was already accepted.',
  REJECTED: 'This request was already declined.',
  CANCELLED: 'This request was cancelled.',
};

const ALREADY_PLAYING_MESSAGE = "You're already a player in this game.";

/** What stops the same player from asking again. */
const EXISTING_REQUEST_MESSAGES: Record<'PENDING' | 'REJECTED', string> = {
  PENDING: JOIN_REQUEST_DUPLICATE_MESSAGE,
  REJECTED: 'The host declined your request to join this game.',
};

const JOIN_REQUEST_SELECT = {
  id: true,
  gameId: true,
  userId: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  respondedAt: true,
} as const satisfies Prisma.JoinRequestSelect;

const HOST_JOIN_REQUEST_SELECT = {
  ...JOIN_REQUEST_SELECT,
  user: { select: AUTHOR_SELECT },
} as const satisfies Prisma.JoinRequestSelect;

type JoinRequestRow = Prisma.JoinRequestGetPayload<{
  select: typeof JOIN_REQUEST_SELECT;
}>;
type HostJoinRequestRow = Prisma.JoinRequestGetPayload<{
  select: typeof HOST_JOIN_REQUEST_SELECT;
}>;

/**
 * The join request workflow: PENDING is the only state that moves, to ACCEPTED or
 * REJECTED (host) or CANCELLED (requester). Every move is a conditional update, so two
 * people acting at once cannot both win. Accepting seats the player (an ACTIVE
 * GameParticipant) in the same transaction; rows are never deleted.
 */
@Injectable()
export class JoinRequestsService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = readGameTimezone(config.get<unknown>('GAME_TIMEZONE'));
  }

  async create(
    userId: string,
    gameId: string,
    dto: CreateJoinRequestDto,
  ): Promise<JoinRequestView> {
    const game = await this.findVisibleGame(userId, gameId);

    if (game.hostId === userId) {
      throw new ForbiddenException(JOIN_REQUEST_OWN_GAME_MESSAGE);
    }

    this.assertJoinable(game);

    const participant = await this.prisma.gameParticipant.findFirst({
      where: { gameId, userId, status: ACTIVE_PLAYER_STATUS },
      select: { id: true },
    });

    if (participant) {
      throw new ConflictException(ALREADY_PLAYING_MESSAGE);
    }

    const message = dto.message ?? null;
    const existing = await this.prisma.joinRequest.findUnique({
      where: { gameId_userId: { gameId, userId } },
      select: { id: true, status: true },
    });

    if (existing) {
      // ACCEPTED without an ACTIVE seat means the player left or was removed.
      if (existing.status === 'PENDING' || existing.status === 'REJECTED') {
        throw new ConflictException(EXISTING_REQUEST_MESSAGES[existing.status]);
      }

      // One row per player and game: asking again reuses it.
      const { count } = await this.prisma.joinRequest.updateMany({
        where: { id: existing.id, status: existing.status },
        data: {
          status: 'PENDING',
          message,
          respondedAt: null,
          createdAt: new Date(),
        },
      });

      if (count === 0) {
        throw new ConflictException(JOIN_REQUEST_DUPLICATE_MESSAGE);
      }

      return toJoinRequestView(await this.findRequest(existing.id));
    }

    try {
      const created = await this.prisma.joinRequest.create({
        data: { gameId, userId, message, status: 'PENDING' },
        select: JOIN_REQUEST_SELECT,
      });
      return toJoinRequestView(created);
    } catch (error) {
      // Two simultaneous requests can both pass the check above; the unique index decides.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(JOIN_REQUEST_DUPLICATE_MESSAGE);
      }

      throw error;
    }
  }

  /** The viewer's request for this game (current or most recent), or null. */
  async findMine(
    userId: string,
    gameId: string,
  ): Promise<JoinRequestView | null> {
    await this.findVisibleGame(userId, gameId);

    const request = await this.prisma.joinRequest.findUnique({
      where: { gameId_userId: { gameId, userId } },
      select: JOIN_REQUEST_SELECT,
    });

    return request ? toJoinRequestView(request) : null;
  }

  /** Only the requester, and only while PENDING. The row is kept as CANCELLED. */
  async cancelMine(userId: string, gameId: string): Promise<JoinRequestView> {
    const { count } = await this.prisma.joinRequest.updateMany({
      where: { gameId, userId, status: 'PENDING' },
      data: { status: 'CANCELLED', respondedAt: null },
    });

    const request = await this.prisma.joinRequest.findUnique({
      where: { gameId_userId: { gameId, userId } },
      select: JOIN_REQUEST_SELECT,
    });

    if (!request) {
      throw new NotFoundException(JOIN_REQUEST_NOT_FOUND_MESSAGE);
    }

    if (count === 0) {
      throw new ConflictException(settledMessage(request.status));
    }

    return toJoinRequestView(request);
  }

  /** Every request on the host's game: PENDING first, then the answered history. */
  async listForHost(
    hostId: string,
    gameId: string,
  ): Promise<HostJoinRequestView[]> {
    await this.findHostedGame(hostId, gameId);

    const requests = await this.prisma.joinRequest.findMany({
      where: { gameId },
      select: HOST_JOIN_REQUEST_SELECT,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return requests.map(toHostJoinRequestView);
  }

  /**
   * One transaction: lock the game row (so acceptances on the same game run one at a
   * time), check the request is PENDING, the game OPEN and not started, the requester
   * still eligible, and ACTIVE players < requiredPlayers; then mark the request ACCEPTED
   * and seat the player as ACTIVE. The GameParticipant triggers re-check capacity and
   * set FULL when the last slot is taken, inside the same transaction. Any failure rolls
   * everything back, so an ACCEPTED request never exists without its seat.
   */
  async accept(
    hostId: string,
    gameId: string,
    requestId: string,
  ): Promise<HostJoinRequestView> {
    await this.findHostedGame(hostId, gameId);

    await withCapacityGuard(() =>
      this.prisma.$transaction(async (tx) => {
        const game = await lockGame(tx, gameId);
        const request = await tx.joinRequest.findFirst({
          where: { id: requestId, gameId },
          select: { status: true, userId: true },
        });

        if (!request) {
          throw new NotFoundException(JOIN_REQUEST_NOT_FOUND_MESSAGE);
        }

        if (request.status !== 'PENDING') {
          throw new ConflictException(settledMessage(request.status));
        }

        this.assertJoinable(game);

        const requester = await tx.user.findFirst({
          where: {
            id: request.userId,
            isActive: true,
            NOT: friendshipWithViewer(hostId, 'BLOCKED'),
          },
          select: { id: true },
        });

        // A pending request does not preserve access after leaving a private club.
        const visibleGame =
          requester &&
          (await tx.game.findFirst({
            where: { AND: [{ id: gameId }, visibleGamesWhere(request.userId)] },
            select: { id: true },
          }));

        if (!requester || !visibleGame) {
          throw new ConflictException(
            JOIN_REQUEST_REQUESTER_UNAVAILABLE_MESSAGE,
          );
        }

        if ((await countSeatedPlayers(tx, gameId)) >= game.requiredPlayers) {
          throw new ConflictException(GAME_FULL_MESSAGE);
        }

        const now = new Date();
        const { count } = await tx.joinRequest.updateMany({
          where: { id: requestId, gameId, status: 'PENDING' },
          data: { status: 'ACCEPTED', respondedAt: now },
        });

        if (count === 0) {
          throw new ConflictException(
            'This request was answered while you were deciding.',
          );
        }

        // One participation row per player and game: a player who left or was removed
        // gets the same row back as ACTIVE, so there is never a second ACTIVE row.
        await tx.gameParticipant.upsert({
          where: { gameId_userId: { gameId, userId: request.userId } },
          create: {
            gameId,
            userId: request.userId,
            status: ACTIVE_PLAYER_STATUS,
          },
          update: {
            status: ACTIVE_PLAYER_STATUS,
            joinedAt: now,
            completedAt: null,
          },
          select: { id: true },
        });
      }),
    );

    return toHostJoinRequestView(await this.findHostRequest(requestId));
  }

  /** Declining is final for this game and keeps the row. */
  async reject(
    hostId: string,
    gameId: string,
    requestId: string,
  ): Promise<HostJoinRequestView> {
    await this.findHostedGame(hostId, gameId);

    const { count } = await this.prisma.joinRequest.updateMany({
      where: { id: requestId, gameId, status: 'PENDING' },
      data: { status: 'REJECTED', respondedAt: new Date() },
    });

    const request = await this.prisma.joinRequest.findFirst({
      where: { id: requestId, gameId },
      select: HOST_JOIN_REQUEST_SELECT,
    });

    if (!request) {
      throw new NotFoundException(JOIN_REQUEST_NOT_FOUND_MESSAGE);
    }

    if (count === 0) {
      throw new ConflictException(settledMessage(request.status));
    }

    return toHostJoinRequestView(request);
  }

  private assertJoinable(game: GameFacts): void {
    if (game.status !== 'OPEN') {
      throw new ConflictException(CLOSED_GAME_MESSAGES[game.status]);
    }

    if (
      hasGameStarted(game.gameDate, game.startTime, localMoment(this.timeZone))
    ) {
      throw new ConflictException(CLOSED_GAME_MESSAGES.ACTIVE);
    }
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

  private async findHostedGame(
    hostId: string,
    gameId: string,
  ): Promise<GameFacts> {
    const game = await this.findVisibleGame(hostId, gameId);

    if (game.hostId !== hostId) {
      throw new ForbiddenException(JOIN_REQUEST_HOST_ONLY_MESSAGE);
    }

    return game;
  }

  private async findRequest(requestId: string): Promise<JoinRequestRow> {
    return this.prisma.joinRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: JOIN_REQUEST_SELECT,
    });
  }

  private async findHostRequest(
    requestId: string,
  ): Promise<HostJoinRequestRow> {
    return this.prisma.joinRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: HOST_JOIN_REQUEST_SELECT,
    });
  }
}

function settledMessage(status: JoinRequestStatus): string {
  return status === 'PENDING'
    ? 'This request is still pending.'
    : SETTLED_REQUEST_MESSAGES[status];
}

function toJoinRequestView(request: JoinRequestRow): JoinRequestView {
  return {
    id: request.id,
    gameId: request.gameId,
    userId: request.userId,
    message: request.message,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    respondedAt: request.respondedAt?.toISOString() ?? null,
  };
}

function toHostJoinRequestView(
  request: HostJoinRequestRow,
): HostJoinRequestView {
  return {
    ...toJoinRequestView(request),
    user: {
      id: request.user.id,
      username: request.user.username,
      firstName: request.user.firstName,
      lastName: request.user.lastName,
      displayName: formatDisplayName(request.user),
      profileImageUrl: request.user.profileImageUrl,
    },
  };
}
