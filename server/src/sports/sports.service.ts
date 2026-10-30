import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

/** User-facing reads; super admin status changes live in the admin module. */
@Injectable()
export class SportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active sports only, alphabetical, with the catch-all "Other" last. */
  async listActive(): Promise<SportView[]> {
    const sports = await this.prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: SPORT_SELECT,
    });

    return [
      ...sports.filter((sport) => sport.name !== CATCH_ALL_SPORT),
      ...sports.filter((sport) => sport.name === CATCH_ALL_SPORT),
    ];
  }

  /** Also answers for a retired sport (isActive false) so old games and posts can still name it. */
  async findOne(id: string): Promise<SportView> {
    const sport = await this.prisma.sport.findUnique({
      where: { id },
      select: SPORT_SELECT,
    });

    if (!sport) {
      throw new NotFoundException(SPORT_NOT_FOUND_MESSAGE);
    }

    return sport;
  }
}
