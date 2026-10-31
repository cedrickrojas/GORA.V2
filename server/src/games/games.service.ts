import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import type { GameStatus } from '../generated/prisma/client';
import { CLUB_NOT_FOUND_MESSAGE } from '../clubs/club-chat.service';
import { hasClubPermission } from '../clubs/club-permissions';
import { CLUB_INACTIVE_MESSAGE } from '../clubs/clubs.service';
import { readGameTimezone } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { GoraPointsService } from '../gora-points/gora-points.service';
import { SPORT_NOT_FOUND_MESSAGE } from '../sports/user-sports.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import {
  GAME_LIST_DEFAULT_LIMIT,
  type CreateGameDto,
  type ListGamesQueryDto,
  type UpdateGameDto,
} from './dto/game.dto';
import { ACTIVE_PLAYER_STATUS, summarizeGameCapacity } from './game-capacity';
import {
  formatGameDate,
  formatGameTime,
  localMoment,
  scheduleProblem,
  toGameDate,
  toGameDateTime,
  type GameSchedule,
} from './game-schedule';
import type { GameView, JoinedGameView } from './game.types';
import { visibleGamesWhere } from './game-visibility';
import { successfulGamePoints } from './game-completion-points';

export const GAME_NOT_FOUND_MESSAGE = 'Game not found.';
export const GAME_HOST_ONLY_MESSAGE = 'Only the host can change this game.';
export const GAME_CLUB_MEMBERS_ONLY_MESSAGE =
  'Only active members of this club can host club games.';

/** Statuses a listing shows when no status filter is given. */
const LISTED_STATUSES: readonly GameStatus[] = ['OPEN', 'FULL', 'ACTIVE'];
const EDITABLE_STATUSES: readonly GameStatus[] = ['OPEN', 'FULL', 'CANCELLED'];
const CANCELLABLE_STATUSES: readonly GameStatus[] = ['OPEN', 'FULL', 'ACTIVE'];

const GAME_BASE_SELECT = {
  id: true,
  hostId: true,
  sportId: true,
  clubId: true,
  title: true,
  description: true,
  requiredPlayers: true,
  autoAccept: true,
  gameDate: true,
  startTime: true,
  endTime: true,
  locationName: true,
  latitude: true,
  longitude: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  sport: { select: { id: true, name: true, iconUrl: true } },
  host: { select: AUTHOR_SELECT },
  club: {
    select: { id: true, name: true, slug: true, profileImageUrl: true },
  },
  _count: {
    select: {
      participants: { where: { status: ACTIVE_PLAYER_STATUS } },
      joinRequests: { where: { status: 'PENDING' } },
    },
  },
} as const satisfies Prisma.GameSelect;

/** The shared fields plus whether this viewer is an ACTIVE player. */
function gameSelect(viewerId: string) {
  return {
    ...GAME_BASE_SELECT,
    participants: {
      where: { userId: viewerId, status: ACTIVE_PLAYER_STATUS },
      select: { id: true, status: true, joinedAt: true },
    },
  } satisfies Prisma.GameSelect;
}

type GameRow = Prisma.GameGetPayload<{ select: ReturnType<typeof gameSelect> }>;

/** Soonest first; ties keep creation order so paging is stable. */
export const GAME_ORDER: Prisma.GameOrderByWithRelationInput[] = [
  { gameDate: 'asc' },
  { startTime: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

/**
 * Game creation and the basic lifecycle (edit, cancel). The host always comes from the
 * JWT, a new game is always OPEN, and games are never deleted. Join requests live in
 * JoinRequestsService and the roster in GamePlayersService.
 */
@Injectable()
export class GamesService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly points?: GoraPointsService,
  ) {
    this.timeZone = readGameTimezone(config.get<unknown>('GAME_TIMEZONE'));
  }

  async create(hostId: string, dto: CreateGameDto): Promise<GameView> {
    const latitude = dto.latitude ?? null;
    const longitude = dto.longitude ?? null;
    assertCoordinates(latitude, longitude);
    this.assertSchedule(dto);
    await this.assertActiveSport(dto.sportId);

    const clubId = dto.clubId ?? null;
    if (clubId) {
      await this.assertCanHostInClub(hostId, clubId);
    }

    const game = await withGameGuards(() =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.game.create({
        data: {
          hostId,
          sportId: dto.sportId,
          clubId,
          title: dto.title,
          description: dto.description ?? null,
          requiredPlayers: dto.requiredPlayers,
          autoAccept: dto.autoAccept ?? false,
          gameDate: toGameDate(dto.gameDate),
          startTime: toGameDateTime(dto.gameDate, dto.startTime),
          endTime: toGameDateTime(dto.gameDate, dto.endTime),
          locationName: dto.locationName,
          latitude,
          longitude,
          status: 'OPEN',
        },
          select: gameSelect(hostId),
        });
        if (this.points) await this.points.awardInTransaction(tx, hostId, 'GAME_CREATED', created.id, 1);
        return created;
      }),
    );

    return toGameView(game, hostId);
  }

  async get(viewerId: string, gameId: string): Promise<GameView> {
    await this.autoCancelExpiredUnfilled();
    const game = await this.findVisible(viewerId, gameId);
    return toGameView(game, viewerId);
  }

  async list(viewerId: string, query: ListGamesQueryDto): Promise<GameView[]> {
    await this.autoCancelExpiredUnfilled();
    const today = localMoment(this.timeZone).date;
    const dateFilter = query.gameDate ?? 'upcoming';
    const gameDate: Prisma.DateTimeFilter =
      dateFilter === 'upcoming'
        ? { gte: toGameDate(today) }
        : { equals: toGameDate(dateFilter === 'today' ? today : dateFilter) };

    const games = await this.prisma.game.findMany({
      where: {
        AND: [
          visibleGamesWhere(viewerId),
          { gameDate },
          query.status
            ? { status: query.status }
            : { status: { in: [...LISTED_STATUSES] } },
          query.sportId ? { sportId: query.sportId } : {},
        ],
      },
      select: gameSelect(viewerId),
      orderBy: GAME_ORDER,
      take: query.limit ?? GAME_LIST_DEFAULT_LIMIT,
      skip: query.offset ?? 0,
    });

    return games.map((game) => toGameView(game, viewerId));
  }

  /** Every game the viewer hosts, whatever its status or date. */
  async listHosted(viewerId: string): Promise<GameView[]> {
    await this.autoCancelExpiredUnfilled();
    const games = await this.prisma.game.findMany({
      where: { hostId: viewerId },
      select: gameSelect(viewerId),
      orderBy: GAME_ORDER,
    });

    return games.map((game) => toGameView(game, viewerId));
  }

  /** Every visible game the viewer is an ACTIVE player in. LEFT and REMOVED are left out. */
  async listPlaying(viewerId: string): Promise<GameView[]> {
    await this.autoCancelExpiredUnfilled();
    const games = await this.prisma.game.findMany({
      where: {
        AND: [
          visibleGamesWhere(viewerId),
          {
            participants: {
              some: { userId: viewerId, status: ACTIVE_PLAYER_STATUS },
            },
          },
        ],
      },
      select: gameSelect(viewerId),
      orderBy: GAME_ORDER,
    });

    return games.map((game) => toGameView(game, viewerId));
  }

  /** Own joins and requests, including past, left, removed, and cancelled entries. */
  async listJoined(viewerId: string): Promise<JoinedGameView[]> {
    await this.autoCancelExpiredUnfilled();
    const games = await this.prisma.game.findMany({
      where: {
        AND: [
          visibleGamesWhere(viewerId),
          { hostId: { not: viewerId } },
          {
            OR: [
              { participants: { some: { userId: viewerId } } },
              { joinRequests: { some: { userId: viewerId } } },
            ],
          },
        ],
      },
      select: {
        ...gameSelect(viewerId),
        participants: {
          where: { userId: viewerId },
          select: { id: true, status: true, joinedAt: true },
        },
        joinRequests: {
          where: { userId: viewerId },
          select: { status: true, createdAt: true },
        },
        leaveRequests: {
          where: { userId: viewerId },
          select: { status: true },
        },
      },
      orderBy: GAME_ORDER,
    });

    return games.map((game) => ({
      ...toGameView(game, viewerId),
      participationStatus: game.participants[0]?.status ?? null,
      joinRequestStatus: game.joinRequests[0]?.status ?? null,
      leaveRequestStatus: game.leaveRequests[0]?.status ?? null,
      joinedAt: game.participants[0]?.joinedAt.toISOString() ?? null,
      requestedAt: game.joinRequests[0]?.createdAt.toISOString() ?? null,
    }));
  }

  async update(
    viewerId: string,
    gameId: string,
    dto: UpdateGameDto,
  ): Promise<GameView> {
    const game = await this.findVisible(viewerId, gameId);
    assertHost(game, viewerId);

    if (!EDITABLE_STATUSES.includes(game.status)) {
      throw new ConflictException(
        `This game is ${game.status.toLowerCase()} and can no longer be edited.`,
      );
    }

    const data: Prisma.GameUncheckedUpdateInput = {};
    if (dto.autoAccept !== undefined) data.autoAccept = dto.autoAccept;

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.locationName !== undefined) data.locationName = dto.locationName;
    if (dto.requiredPlayers !== undefined) {
      data.requiredPlayers = dto.requiredPlayers;
    }

    if (dto.sportId !== undefined && dto.sportId !== game.sportId) {
      await this.assertActiveSport(dto.sportId);
      data.sportId = dto.sportId;
    }

    if (dto.clubId !== undefined && dto.clubId !== game.clubId) {
      if (dto.clubId) {
        await this.assertCanHostInClub(viewerId, dto.clubId);
      }
      data.clubId = dto.clubId;
    }

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const latitude =
        dto.latitude !== undefined ? dto.latitude : game.latitude;
      const longitude =
        dto.longitude !== undefined ? dto.longitude : game.longitude;
      assertCoordinates(latitude, longitude);
      data.latitude = latitude;
      data.longitude = longitude;
    }

    if (
      dto.gameDate !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined
    ) {
      const endTime =
        dto.endTime ?? (game.endTime ? formatGameTime(game.endTime) : null);
      if (!endTime) {
        throw new BadRequestException('Add an end time.');
      }

      const schedule: GameSchedule = {
        gameDate: dto.gameDate ?? formatGameDate(game.gameDate),
        startTime: dto.startTime ?? formatGameTime(game.startTime),
        endTime,
      };
      this.assertSchedule(schedule);
      data.gameDate = toGameDate(schedule.gameDate);
      data.startTime = toGameDateTime(schedule.gameDate, schedule.startTime);
      data.endTime = toGameDateTime(schedule.gameDate, schedule.endTime);
      if (game.status === 'CANCELLED') data.status = 'OPEN';
    }

    if (Object.keys(data).length === 0) {
      return toGameView(game, viewerId);
    }

    const updated = await withGameGuards(() =>
      this.prisma.game.update({
        where: {
          id: gameId,
          hostId: viewerId,
          status: { in: [...EDITABLE_STATUSES] },
        },
        data,
        select: gameSelect(viewerId),
      }),
    ).catch((error: unknown) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(
          'This game changed and can no longer be edited. Refresh and try again.',
        );
      }
      throw error;
    });

    return toGameView(updated, viewerId);
  }

  /** Marks the game CANCELLED. The row, its history, and any roster are kept. */
  async cancel(viewerId: string, gameId: string): Promise<GameView> {
    const game = await this.findVisible(viewerId, gameId);
    assertHost(game, viewerId);

    const { count } = await this.prisma.game.updateMany({
      where: {
        id: gameId,
        hostId: viewerId,
        status: { in: [...CANCELLABLE_STATUSES] },
      },
      data: { status: 'CANCELLED' },
    });

    if (count === 0) {
      const current = await this.findVisible(viewerId, gameId);
      throw new ConflictException(
        current.status === 'CANCELLED'
          ? 'This game is already cancelled.'
          : 'A completed game cannot be cancelled.',
      );
    }

    return this.get(viewerId, gameId);
  }

  private async findVisible(
    viewerId: string,
    gameId: string,
  ): Promise<GameRow> {
    const game = await this.prisma.game.findFirst({
      where: { AND: [{ id: gameId }, visibleGamesWhere(viewerId)] },
      select: gameSelect(viewerId),
    });

    if (!game) {
      throw new NotFoundException(GAME_NOT_FOUND_MESSAGE);
    }

    return game;
  }

  /** Persist cancellation for expired games that never reached their required roster. */
  private async autoCancelExpiredUnfilled(): Promise<void> {
    const today = localMoment(this.timeZone).date;
    const expiredGames = await this.prisma.game.findMany({
      where: { status: { in: ['OPEN', 'FULL', 'ACTIVE'] }, gameDate: { lt: toGameDate(today) } },
      select: {
        id: true,
        requiredPlayers: true,
        _count: { select: { participants: { where: { status: ACTIVE_PLAYER_STATUS } } } },
      },
    });
    const unfilledIds = expiredGames
      .filter((game) => game._count.participants < game.requiredPlayers)
      .map((game) => game.id);
    const completedIds = expiredGames
      .filter((game) => game._count.participants >= game.requiredPlayers)
      .map((game) => game.id);
    if (unfilledIds.length > 0) {
      await this.prisma.game.updateMany({
        where: { id: { in: unfilledIds }, status: { in: ['OPEN', 'FULL', 'ACTIVE'] }, gameDate: { lt: toGameDate(today) } },
        data: { status: 'CANCELLED' },
      });
    }
    for (const gameId of completedIds) {
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.game.updateMany({
          where: { id: gameId, status: { in: ['OPEN', 'FULL', 'ACTIVE'] }, gameDate: { lt: toGameDate(today) } },
          data: { status: 'COMPLETED' },
        });
        if (!result.count) return null;
        await tx.gameParticipant.updateMany({ where: { gameId, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt: new Date() } });
        const completedGame = await tx.game.findUnique({ where: { id: gameId }, select: { hostId: true, requiredPlayers: true } });
        if (!completedGame) return null;
        if (!this.points) return completedGame;
        await this.points.awardInTransaction(
          tx,
          completedGame.hostId,
          'GAME_COMPLETED_HOST',
          gameId,
          successfulGamePoints(completedGame.requiredPlayers),
        );
        return completedGame;
      });
    }
  }

  private assertSchedule(schedule: GameSchedule): void {
    const problem = scheduleProblem(schedule, localMoment(this.timeZone));

    if (problem) {
      throw new BadRequestException(problem);
    }
  }

  private async assertActiveSport(sportId: string): Promise<void> {
    const sport = await this.prisma.sport.findFirst({
      where: { id: sportId, isActive: true },
      select: { id: true },
    });

    if (!sport) {
      throw new NotFoundException(SPORT_NOT_FOUND_MESSAGE);
    }
  }

  /** Uses the club's own permission table: an ACTIVE member of an active club may host. */
  private async assertCanHostInClub(
    userId: string,
    clubId: string,
  ): Promise<void> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: {
        isActive: true,
        isPublic: true,
        members: { where: { userId }, select: { role: true, status: true } },
      },
    });

    if (!club) {
      throw new NotFoundException(CLUB_NOT_FOUND_MESSAGE);
    }

    if (!club.isActive) {
      throw new ForbiddenException(CLUB_INACTIVE_MESSAGE);
    }

    if (!hasClubPermission(club.members[0] ?? null, 'HOST_CLUB_GAMES', club)) {
      throw new ForbiddenException(GAME_CLUB_MEMBERS_ONLY_MESSAGE);
    }
  }
}

function assertHost(game: GameRow, viewerId: string): void {
  if (game.hostId !== viewerId) {
    throw new ForbiddenException(GAME_HOST_ONLY_MESSAGE);
  }
}

function assertCoordinates(
  latitude: number | null,
  longitude: number | null,
): void {
  if ((latitude === null) !== (longitude === null)) {
    throw new BadRequestException(
      'Give both latitude and longitude, or neither.',
    );
  }
}

/** The database triggers are the last line of defence; answer them with a clear status. */
async function withGameGuards<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (databaseErrorMentions(error, 'Game_capacity_roster_check')) {
      throw new ConflictException(
        'Required players cannot be lower than the players already in the game.',
      );
    }

    if (databaseErrorMentions(error, 'Only active members of an active club')) {
      throw new ForbiddenException(GAME_CLUB_MEMBERS_ONLY_MESSAGE);
    }

    throw error;
  }
}

export function databaseErrorMentions(error: unknown, text: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const details =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? `${error.message} ${JSON.stringify(error.meta ?? {})}`
      : error.message;
  return details.includes(text);
}

function toGameView(game: GameRow, viewerId: string): GameView {
  const capacity = summarizeGameCapacity(
    game.requiredPlayers,
    game._count.participants,
  );
  const isHost = game.hostId === viewerId;

  return {
    id: game.id,
    title: game.title,
    description: game.description,
    sport: game.sport,
    host: {
      id: game.host.id,
      username: game.host.username,
      firstName: game.host.firstName,
      lastName: game.host.lastName,
      displayName: formatDisplayName(game.host),
      profileImageUrl: game.host.profileImageUrl,
    },
    club: game.club,
    requiredPlayers: capacity.requiredPlayers,
    autoAccept: game.autoAccept,
    currentPlayers: capacity.currentPlayers,
    remainingSlots: capacity.remainingSlots,
    status: game.status,
    gameDate: formatGameDate(game.gameDate),
    startTime: formatGameTime(game.startTime),
    endTime: game.endTime ? formatGameTime(game.endTime) : null,
    locationName: game.locationName,
    latitude: game.latitude,
    longitude: game.longitude,
    isHost,
    isPlayer: game.participants.some(
      (player) => player.status === ACTIVE_PLAYER_STATUS,
    ),
    pendingRequestCount: isHost ? game._count.joinRequests : null,
    canEdit: isHost && EDITABLE_STATUSES.includes(game.status),
    canCancel: isHost && CANCELLABLE_STATUSES.includes(game.status),
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  };
}
