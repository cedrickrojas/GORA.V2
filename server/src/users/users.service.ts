import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CURRENT_USER_SELECT,
  SAFE_USER_SELECT,
  type CreateUserData,
  type CurrentUser,
  type SafeUser,
  type UserCredentials,
  type UserReference,
} from './user.types';

export const USERNAME_TAKEN_MESSAGE = 'Username is already taken.';
export const EMAIL_TAKEN_MESSAGE = 'Email is already registered.';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData): Promise<SafeUser> {
    await this.assertAvailable(data.username, data.email);

    try {
      return await this.prisma.user.create({
        data,
        select: SAFE_USER_SELECT,
      });
    } catch (error) {
      throw this.toConflict(error) ?? error;
    }
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...SAFE_USER_SELECT, passwordHash: true, isActive: true },
    });
  }

  /** Returns the user only while the account is active. */
  findActiveById(id: string): Promise<CurrentUser | null> {
    return this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: CURRENT_USER_SELECT,
    });
  }

  findActiveByUsername(username: string): Promise<UserReference | null> {
    return this.prisma.user.findFirst({
      where: { username: username.trim().toLowerCase(), isActive: true },
      select: { id: true, username: true },
    });
  }

  /** Returns the subset of ids that belong to active accounts. */
  async filterActiveIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  private async assertAvailable(
    username: string,
    email: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true },
    });

    if (!existing) {
      return;
    }

    throw new ConflictException(
      existing.username === username
        ? USERNAME_TAKEN_MESSAGE
        : EMAIL_TAKEN_MESSAGE,
    );
  }

  /** Two registrations can race past assertAvailable; the unique index decides. */
  private toConflict(error: unknown): ConflictException | null {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return null;
    }

    const detail = JSON.stringify(error.meta ?? {});

    if (detail.includes('email')) {
      return new ConflictException(EMAIL_TAKEN_MESSAGE);
    }

    if (detail.includes('username')) {
      return new ConflictException(USERNAME_TAKEN_MESSAGE);
    }

    return new ConflictException('Username or email is already in use.');
  }
}
