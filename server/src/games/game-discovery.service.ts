import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client';
import { readGameTimezone } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { SPORT_NOT_FOUND_MESSAGE } from '../sports/user-sports.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import {
  DEFAULT_DISCOVERY_STATUSES,
  DISCOVERY_DEFAULT_LIMIT,
  type DiscoverGamesQueryDto,
} from './dto/discover-games.dto';
import { ACTIVE_PLAYER_STATUS, summarizeGameCapacity } from './game-capacity';
import {
  addDays,
  formatGameDate,
  formatGameTime,
  localMoment,
  toGameDate,
} from './game-schedule';
import type { DiscoveredGameView, GameDiscoveryResult } from './game.types';
import { visibleGamesWhere } from './game-visibility';
import { GAME_ORDER } from './games.service';
import {
  boundingBox,
  distanceKm,
  roundDistanceKm,
  type GeoPoint,
} from './geo-distance';

/**
 * How many candidates a centered search measures before sorting by distance. The
 * bounding box keeps radius searches far below this; an "any distance" search with a
 * center sorts the soonest this many games by distance.
 */
export const DISCOVERY_SCAN_LIMIT = 500;

export const DISTANCE_NEEDS_CENTER_MESSAGE =
  'distanceKm needs latitude and longitude.';
export const COORDINATES_TOGETHER_MESSAGE =
  'Give both latitude and longitude, or neither.';

function discoverySelect(viewerId: string) {
  return {
    id: true,
    hostId: true,
    title: true,
    requiredPlayers: true,
    gameDate: true,
    startTime: true,
    endTime: true,
    locationName: true,
    latitude: true,
    longitude: true,
    status: true,
    sport: { select: { id: true, name: true, iconUrl: true } },
    host: { select: AUTHOR_SELECT },
    club: { select: { id: true, name: true } },
    _count: {
      select: { participants: { where: { status: ACTIVE_PLAYER_STATUS } } },
    },
    participants: {
      where: { userId: viewerId, status: ACTIVE_PLAYER_STATUS },
      select: { id: true },
    },
    joinRequests: { where: { userId: viewerId }, select: { status: true } },
  } satisfies Prisma.GameSelect;
}

type DiscoveryRow = Prisma.GameGetPayload<{
  select: ReturnType<typeof discoverySelect>;
}>;

interface DateRange {
  from: string;
  to: string | null;
}

/**
 * Finds real GORA games for the map and list: visible games only (visibleGamesWhere),
 * filtered by sport id, game date, and status, optionally around a center point. It only
 * reads; it never changes a game. The center is used for this request and never stored.
 */
@Injectable()
export class GameDiscoveryService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = readGameTimezone(config.get<unknown>('GAME_TIMEZONE'));
  }

  async discover(
    viewerId: string,
    query: DiscoverGamesQueryDto,
  ): Promise<GameDiscoveryResult> {
    const center = readCenter(query);
    const radiusKm = query.distanceKm ?? null;

    if (radiusKm !== null && !center) {
      throw new BadRequestException(DISTANCE_NEEDS_CENTER_MESSAGE);
    }

    if (query.sportId) {
      await this.assertActiveSport(query.sportId);
    }

    const range = this.dateRange(query.date);
    const limit = query.limit ?? DISCOVERY_DEFAULT_LIMIT;
    const filters: Prisma.GameWhereInput[] = [
      visibleGamesWhere(viewerId),
      {
        gameDate: range.to
          ? { gte: toGameDate(range.from), lte: toGameDate(range.to) }
          : { gte: toGameDate(range.from) },
      },
      query.status
        ? { status: query.status }
        : { status: { in: [...DEFAULT_DISCOVERY_STATUSES] } },
    ];

    if (query.sportId) {
      filters.push({ sportId: query.sportId });
    }

    if (center && radiusKm !== null) {
      filters.push(withinBox(center, radiusKm));
    }

    const rows = await this.prisma.game.findMany({
      where: { AND: filters },
      select: discoverySelect(viewerId),
      orderBy: GAME_ORDER,
      take: center ? DISCOVERY_SCAN_LIMIT : limit,
    });

    const games = center
      ? byDistance(rows, center, radiusKm).slice(0, limit)
      : rows.map((row) => ({ row, distance: null }));

    return {
      games: games.map(({ row, distance }) =>
        toDiscoveredGame(row, viewerId, distance),
      ),
      dateFrom: range.from,
      dateTo: range.to,
      distanceKm: radiusKm,
    };
  }

  /** Presets are decided on the game clock, the same one that decides "today" for games. */
  private dateRange(date: string | undefined): DateRange {
    const today = localMoment(this.timeZone).date;

    switch (date) {
      case undefined:
        return { from: today, to: null };
      case 'today':
        return { from: today, to: today };
      case 'tomorrow': {
        const tomorrow = addDays(today, 1);
        return { from: tomorrow, to: tomorrow };
      }
      case 'this-week':
        return { from: today, to: addDays(today, 6) };
      default:
        return { from: date, to: date };
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
}

function readCenter(query: DiscoverGamesQueryDto): GeoPoint | null {
  const { latitude, longitude } = query;

  if (latitude !== undefined && longitude !== undefined) {
    return { latitude, longitude };
  }

  if (latitude !== undefined || longitude !== undefined) {
    throw new BadRequestException(COORDINATES_TOGETHER_MESSAGE);
  }

  return null;
}

/** Games without coordinates never match: a radius only means something with a position. */
function withinBox(center: GeoPoint, radiusKm: number): Prisma.GameWhereInput {
  const box = boundingBox(center, radiusKm);

  return {
    latitude: { not: null, gte: box.minLatitude, lte: box.maxLatitude },
    longitude:
      box.minLongitude === null || box.maxLongitude === null
        ? { not: null }
        : { not: null, gte: box.minLongitude, lte: box.maxLongitude },
  };
}

interface MeasuredRow {
  row: DiscoveryRow;
  distance: number | null;
}

/**
 * Nearest first; equal distances keep the soonest-first order the rows arrived in. With a
 * radius, games without coordinates or outside it are dropped. Without one (any
 * distance) games without coordinates stay, after every located game, with no distance.
 */
function byDistance(
  rows: readonly DiscoveryRow[],
  center: GeoPoint,
  radiusKm: number | null,
): MeasuredRow[] {
  const located: MeasuredRow[] = [];
  const unlocated: MeasuredRow[] = [];

  for (const row of rows) {
    if (row.latitude === null || row.longitude === null) {
      if (radiusKm === null) {
        unlocated.push({ row, distance: null });
      }
      continue;
    }

    const distance = distanceKm(center, {
      latitude: row.latitude,
      longitude: row.longitude,
    });

    if (radiusKm === null || distance <= radiusKm) {
      located.push({ row, distance });
    }
  }

  located.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return [...located, ...unlocated];
}

function toDiscoveredGame(
  row: DiscoveryRow,
  viewerId: string,
  distance: number | null,
): DiscoveredGameView {
  const capacity = summarizeGameCapacity(
    row.requiredPlayers,
    row._count.participants,
  );

  return {
    id: row.id,
    title: row.title,
    sport: row.sport,
    host: {
      id: row.host.id,
      username: row.host.username,
      firstName: row.host.firstName,
      lastName: row.host.lastName,
      displayName: formatDisplayName(row.host),
      profileImageUrl: row.host.profileImageUrl,
    },
    club: row.club,
    gameDate: formatGameDate(row.gameDate),
    startTime: formatGameTime(row.startTime),
    endTime: row.endTime ? formatGameTime(row.endTime) : null,
    locationName: row.locationName,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceKm: distance === null ? null : roundDistanceKm(distance),
    currentPlayers: capacity.currentPlayers,
    requiredPlayers: capacity.requiredPlayers,
    remainingSlots: capacity.remainingSlots,
    status: row.status,
    isHost: row.hostId === viewerId,
    isPlayer: row.participants.length > 0,
    myJoinRequestStatus: row.joinRequests[0]?.status ?? null,
  };
}
