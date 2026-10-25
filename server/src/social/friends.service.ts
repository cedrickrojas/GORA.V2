import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTHOR_SELECT } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { formatDisplayName } from '../users/display-name';
import { toPairKey } from './relationship';
import { friendshipWithViewer } from '../posts/post-visibility';

const PERSON_SELECT = { ...AUTHOR_SELECT, city: true } as const;

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  search(viewerId: string, rawQuery: string) {
    const query = rawQuery.trim().replace(/^@/, '').slice(0, 80);
    if (query.length < 2) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: viewerId },
        NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          ...(query.includes(' ')
            ? [
                {
                  AND: query.split(/\s+/).map((part) => ({
                    OR: [
                      {
                        firstName: {
                          contains: part,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        lastName: {
                          contains: part,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  })),
                },
              ]
            : []),
        ],
      },
      select: PERSON_SELECT,
      orderBy: { username: 'asc' },
      take: 30,
    });
  }

  async list(viewerId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: viewerId }, { receiverId: viewerId }],
        status: { in: ['ACCEPTED', 'PENDING', 'BLOCKED'] },
        requester: { isActive: true },
        receiver: { isActive: true },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      include: {
        requester: { select: PERSON_SELECT },
        receiver: { select: PERSON_SELECT },
      },
    });
    const other = (row: (typeof rows)[number]) =>
      row.requesterId === viewerId ? row.receiver : row.requester;
    const friendIds = rows
      .filter((row) => row.status === 'ACCEPTED')
      .map((row) => other(row).id);
    const requestIds = rows
      .filter((row) => row.status === 'PENDING')
      .map((row) => other(row).id);
    const shared =
      friendIds.length && requestIds.length
        ? await this.prisma.friendship.findMany({
            where: {
              status: 'ACCEPTED',
              OR: [
                {
                  requesterId: { in: requestIds },
                  receiverId: { in: friendIds },
                },
                {
                  receiverId: { in: requestIds },
                  requesterId: { in: friendIds },
                },
              ],
            },
            select: { requesterId: true, receiverId: true },
          })
        : [];
    const person = (user: ReturnType<typeof other>) => ({
      id: user.id,
      username: user.username,
      displayName: formatDisplayName(user),
      avatarUrl: user.profileImageUrl,
      city: user.city ?? '',
      primarySport: '',
      distanceKm: 0,
      followers: 0,
      gamesCompleted: 0,
      featured: false,
    });
    return {
      friends: rows
        .filter((row) => row.status === 'ACCEPTED')
        .map((row) => person(other(row))),
      requests: rows
        .filter((row) => row.status === 'PENDING')
        .map((row) => ({
          id: row.id,
          direction:
            row.receiverId === viewerId
              ? ('RECEIVED' as const)
              : ('SENT' as const),
          player: person(other(row)),
          createdAt: row.createdAt.toISOString(),
          mutualFriends: shared.filter(
            (pair) =>
              pair.requesterId === other(row).id ||
              pair.receiverId === other(row).id,
          ).length,
        })),
      blockedIds: rows
        .filter(
          (row) => row.status === 'BLOCKED' && row.blockedById === viewerId,
        )
        .map((row) => other(row).id),
    };
  }

  async send(viewerId: string, username: string) {
    const target = await this.users.findActiveByUsername(username);
    if (!target) throw new NotFoundException('User not found.');
    if (target.id === viewerId)
      throw new BadRequestException('You cannot add yourself.');
    const pairKey = toPairKey(viewerId, target.id);
    let row = await this.prisma.friendship.findUnique({ where: { pairKey } });
    if (!row) {
      try {
        row = await this.prisma.friendship.create({
          data: { requesterId: viewerId, receiverId: target.id, pairKey },
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        )
          throw error;
        row = await this.prisma.friendship.findUniqueOrThrow({
          where: { pairKey },
        });
      }
    }
    if (row.status === 'BLOCKED')
      throw new NotFoundException('User not found.');
    if (row.status === 'ACCEPTED') return this.list(viewerId);
    if (row.status === 'PENDING' && row.requesterId !== viewerId) {
      throw new ConflictException(
        'This player already sent you a request. Accept it to become friends.',
      );
    }
    if (row.status === 'REJECTED') {
      const result = await this.prisma.friendship.updateMany({
        where: { id: row.id, status: 'REJECTED' },
        data: {
          status: 'PENDING',
          requesterId: viewerId,
          receiverId: target.id,
          blockedById: null,
          createdAt: new Date(),
        },
      });
      if (!result.count)
        throw new ConflictException(
          'This relationship changed. Refresh and try again.',
        );
    }
    return this.list(viewerId);
  }

  async accept(viewerId: string, requestId: string) {
    const result = await this.prisma.friendship.updateMany({
      where: {
        id: requestId,
        receiverId: viewerId,
        status: 'PENDING',
        requester: { isActive: true },
        receiver: { isActive: true },
      },
      data: { status: 'ACCEPTED' },
    });
    if (!result.count)
      throw new NotFoundException(
        'This friend request is no longer available.',
      );
    return this.list(viewerId);
  }

  async dismiss(viewerId: string, requestId: string) {
    const result = await this.prisma.friendship.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
        OR: [{ requesterId: viewerId }, { receiverId: viewerId }],
      },
      data: { status: 'REJECTED' },
    });
    if (!result.count)
      throw new NotFoundException(
        'This friend request is no longer available.',
      );
    return this.list(viewerId);
  }

  async remove(viewerId: string, username: string, unblock = false) {
    const target = await this.users.findActiveByUsername(username);
    if (!target) throw new NotFoundException('User not found.');
    const result = await this.prisma.friendship.updateMany({
      where: {
        pairKey: toPairKey(viewerId, target.id),
        status: unblock ? 'BLOCKED' : 'ACCEPTED',
        ...(unblock ? { blockedById: viewerId } : {}),
      },
      data: { status: 'REJECTED', blockedById: null },
    });
    if (!result.count)
      throw new NotFoundException('This relationship is no longer available.');
    return this.list(viewerId);
  }
}
