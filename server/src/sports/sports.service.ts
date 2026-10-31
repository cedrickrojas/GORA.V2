import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { readGameTimezone } from '../config/env.validation';
import { localMoment, toGameDate } from '../games/game-schedule';
import type { SportView } from './sport.types';
import { SPORT_NOT_FOUND_MESSAGE } from './user-sports.service';

const CATCH_ALL_SPORT = 'Other';

const SPORT_SELECT = {
  id: true,
  name: true,
  description: true,
  iconUrl: true,
  isActive: true,
} as const;

function sportStatsSelect(today: Date) {
  return {
    ...SPORT_SELECT,
    _count: {
      select: {
        players: { where: { user: { isActive: true } } },
        games: { where: { status: 'OPEN' as const, gameDate: { gte: today } } },
      },
    },
  } as const;
}

/** User-facing reads; super admin status changes live in the admin module. */
@Injectable()
export class SportsService {
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = readGameTimezone(config.get<unknown>('GAME_TIMEZONE'));
  }

  /** Active sports only, alphabetical, with the catch-all "Other" last. */
  async listActive(): Promise<SportView[]> {
    const today = toGameDate(localMoment(this.timeZone).date);
    const sports = await this.prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: sportStatsSelect(today),
    });

    const orderedSports = [
      ...sports.filter((sport) => sport.name !== CATCH_ALL_SPORT),
      ...sports.filter((sport) => sport.name === CATCH_ALL_SPORT),
    ];
    return orderedSports.map(({ _count, ...sport }) => ({
      ...sport,
      activePlayers: _count.players,
      openGames: _count.games,
    }));
  }

  /** Also answers for a retired sport (isActive false) so old games and posts can still name it. */
  async findOne(id: string): Promise<SportView> {
    const sport = await this.prisma.sport.findUnique({
      where: { id },
      select: sportStatsSelect(toGameDate(localMoment(this.timeZone).date)),
    });

    if (!sport) {
      throw new NotFoundException(SPORT_NOT_FOUND_MESSAGE);
    }

    const { _count, ...view } = sport;
    return { ...view, activePlayers: _count.players, openGames: _count.games };
  }
}
