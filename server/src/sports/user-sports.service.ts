import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AddUserSportDto, UpdateUserSportDto } from './dto/user-sport.dto';
import type { UserSportView } from './sport.types';

export const SPORT_NOT_FOUND_MESSAGE = 'Sport not found.';
export const USER_SPORT_NOT_FOUND_MESSAGE =
  "You haven't added this sport to your profile.";

const USER_SPORT_SELECT = {
  skillLevel: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  sport: { select: { id: true, name: true, iconUrl: true } },
} as const;

type UserSportRow = Prisma.UserSportGetPayload<{
  select: typeof USER_SPORT_SELECT;
}>;

/**
 * A user's own sports (UserSport rows). Every method takes the owner's id from the JWT,
 * so one user can never read or modify another user's rows, and the Sport rows are read-only.
 */
@Injectable()
export class UserSportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** In the order they were added. Retired (inactive) sports are left out. */
  async list(userId: string): Promise<UserSportView[]> {
    const rows = await this.prisma.userSport.findMany({
      where: { userId, sport: { isActive: true } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: USER_SPORT_SELECT,
    });

    return rows.map(toUserSportView);
  }

  async add(userId: string, dto: AddUserSportDto): Promise<UserSportView> {
    const sport = await this.prisma.sport.findFirst({
      where: { id: dto.sportId, isActive: true },
      select: { id: true, name: true },
    });

    if (!sport) {
      throw new NotFoundException(SPORT_NOT_FOUND_MESSAGE);
    }

    const duplicate = new ConflictException(
      `${sport.name} is already on your profile. Edit it instead.`,
    );
    const existing = await this.prisma.userSport.findUnique({
      where: { userId_sportId: { userId, sportId: sport.id } },
      select: { id: true },
    });

    if (existing) {
      throw duplicate;
    }

    try {
      const row = await this.prisma.userSport.create({
        data: {
          userId,
          sportId: sport.id,
          skillLevel: dto.skillLevel,
          position: dto.position ?? null,
        },
        select: USER_SPORT_SELECT,
      });

      return toUserSportView(row);
    } catch (error) {
      // Two simultaneous adds can both pass the check above; the unique index decides.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw duplicate;
      }

      throw error;
    }
  }

  async update(
    userId: string,
    sportId: string,
    dto: UpdateUserSportDto,
  ): Promise<UserSportView> {
    const data: Prisma.UserSportUpdateInput = {};

    if (dto.skillLevel !== undefined) data.skillLevel = dto.skillLevel;
    if (dto.position !== undefined) data.position = dto.position;

    try {
      const row = await this.prisma.userSport.update({
        where: { userId_sportId: { userId, sportId } },
        data,
        select: USER_SPORT_SELECT,
      });

      return toUserSportView(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(USER_SPORT_NOT_FOUND_MESSAGE);
      }

      throw error;
    }
  }

  /** Deletes only the UserSport row; the Sport itself is never touched. */
  async remove(userId: string, sportId: string): Promise<void> {
    const removed = await this.prisma.userSport.deleteMany({
      where: { userId, sportId },
    });

    if (removed.count === 0) {
      throw new NotFoundException(USER_SPORT_NOT_FOUND_MESSAGE);
    }
  }
}

function toUserSportView(row: UserSportRow): UserSportView {
  return {
    sportId: row.sport.id,
    name: row.sport.name,
    iconUrl: row.sport.iconUrl,
    skillLevel: row.skillLevel,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
