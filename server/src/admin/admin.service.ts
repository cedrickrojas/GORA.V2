import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTHOR_SELECT, SAFE_USER_SELECT } from '../users/user.types';
import {
  AdminPageQuery,
  AdminReportsQuery,
  AdminUsersQuery,
  CreateSportDto,
  UpdateAdminUserDto,
  UpdateReportDto,
} from './admin.dto';

const PAGE_SIZE = 20;
const USER_SELECT = {
  ...SAFE_USER_SELECT,
  isActive: true,
  createdAt: true,
  city: true,
} as const;

/** Shared with the bootstrap command; serializes account permission changes. */
export async function lockAdminAccounts(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(74628103)::text`;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
    const [
      users,
      activeUsers,
      posts,
      games,
      clubs,
      reels,
      pendingReports,
      reviewingReports,
      pendingHelpMessages,
      registrations,
      sportRows,
      gamesBySport,
      gameCreatorsBySport,
      postsBySport,
      postCreatorsBySport,
      activeGameParticipants,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.post.count(),
      this.prisma.game.count(),
      this.prisma.club.count(),
      this.prisma.reel.count(),
      this.prisma.report.count({ where: { status: 'PENDING', reason: { not: 'HELP_REQUEST' } } }),
      this.prisma.report.count({ where: { status: 'REVIEWING', reason: { not: 'HELP_REQUEST' } } }),
      this.prisma.report.count({ where: { status: 'PENDING', reason: 'HELP_REQUEST' } }),
      this.prisma.$queryRaw<{ day: string; total: bigint }[]>`
        SELECT to_char("createdAt", 'YYYY-MM-DD') AS day, count(*) AS total
        FROM "User" WHERE "createdAt" >= ${start} GROUP BY day ORDER BY day`,
      this.prisma.sport.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, isActive: true, _count: { select: { players: true } } },
      }),
      this.prisma.game.groupBy({ by: ['sportId'], _count: { _all: true } }),
      this.prisma.game.groupBy({ by: ['sportId', 'hostId'] }),
      this.prisma.post.groupBy({
        by: ['sportId'],
        where: { sportId: { not: null }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.post.groupBy({
        by: ['sportId', 'userId'],
        where: { sportId: { not: null }, deletedAt: null },
      }),
      this.prisma.gameParticipant.count({ where: { status: 'ACTIVE' } }),
    ]);
    const dailyRegistrations = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + i);
      const day = date.toISOString().slice(0, 10);
      return {
        day,
        total: Number(registrations.find((row) => row.day === day)?.total ?? 0),
      };
    });
    const gameTotals = new Map(gamesBySport.map((row) => [row.sportId, row._count._all]));
    const sportGameCreators = new Map<string, Set<string>>();
    for (const row of gameCreatorsBySport) {
      const creators = sportGameCreators.get(row.sportId) ?? new Set<string>();
      creators.add(row.hostId);
      sportGameCreators.set(row.sportId, creators);
    }
    const postTotals = new Map(postsBySport.flatMap((row) => (row.sportId ? [[row.sportId, row._count._all] as const] : [])));
    const sportPostCreators = new Map<string, Set<string>>();
    for (const row of postCreatorsBySport) {
      if (!row.sportId) continue;
      const creators = sportPostCreators.get(row.sportId) ?? new Set<string>();
      creators.add(row.userId);
      sportPostCreators.set(row.sportId, creators);
    }
    const sportAnalytics = sportRows
      .map((sport) => {
        const gamesCreated = gameTotals.get(sport.id) ?? 0;
        const postsAboutSport = postTotals.get(sport.id) ?? 0;
        const gameCreators = sportGameCreators.get(sport.id)?.size ?? 0;
        const postCreators = sportPostCreators.get(sport.id)?.size ?? 0;
        return {
          id: sport.id,
          name: sport.name,
          isActive: sport.isActive,
          players: sport._count.players,
          gamesCreated,
          gameCreators,
          postsAboutSport,
          postCreators,
          activity: gamesCreated + postsAboutSport,
        };
      })
      .sort((a, b) => b.activity - a.activity || a.name.localeCompare(b.name));
    return {
      users,
      activeUsers,
      posts,
      games,
      clubs,
      reels,
      pendingReports,
      reviewingReports,
      pendingHelpMessages,
      dailyRegistrations,
      gameCreators: new Set(gameCreatorsBySport.map((row) => row.hostId)).size,
      postsAboutGames: postsBySport.reduce((total, row) => total + row._count._all, 0),
      gamePosters: new Set(postCreatorsBySport.map((row) => row.userId)).size,
      activeGameParticipants,
      sportAnalytics,
    };
  }

  async users(query: AdminUsersQuery) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { isActive: query.status === 'active' } : {}),
      ...(search
        ? {
            OR: ['username', 'email', 'firstName', 'lastName'].map((field) => ({
              [field]: { contains: search, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: PAGE_SIZE };
  }

  async updateUser(actorId: string, id: string, body: UpdateAdminUserDto) {
    if (body.role === undefined && body.isActive === undefined)
      throw new BadRequestException(
        'Choose a role or account status to update.',
      );
    return this.prisma.$transaction(async (tx) => {
      await lockAdminAccounts(tx);
      // Recheck after acquiring the lock: a concurrent request may revoke the actor.
      await this.assertActor(tx, actorId);
      const before = await tx.user.findUnique({
        where: { id },
        select: USER_SELECT,
      });
      if (!before) throw new NotFoundException('User not found.');
      if (
        id === actorId &&
        (body.isActive === false ||
          (body.role !== undefined && body.role !== 'SUPER_ADMIN'))
      ) {
        throw new BadRequestException(
          'You cannot suspend or demote your own super admin account.',
        );
      }
      if (
        before.role === 'SUPER_ADMIN' &&
        before.isActive &&
        (body.isActive === false ||
          (body.role !== undefined && body.role !== 'SUPER_ADMIN'))
      ) {
        const remaining = await tx.user.count({
          where: { role: 'SUPER_ADMIN', isActive: true },
        });
        if (remaining <= 1)
          throw new ConflictException(
            'At least one active super admin must remain.',
          );
      }
      const after = await tx.user.update({
        where: { id },
        data: body,
        select: USER_SELECT,
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'USER_UPDATED',
          targetId: id,
          details: {
            username: before.username,
            before: { role: before.role, isActive: before.isActive },
            after: { role: after.role, isActive: after.isActive },
          },
        },
      });
      return after;
    });
  }

  async reports(query: AdminReportsQuery) {
    const where: Prisma.ReportWhereInput = {
      ...(query.reason ? { reason: query.reason } : { reason: { not: 'HELP_REQUEST' } }),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          reason: true,
          description: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          reporter: { select: AUTHOR_SELECT },
          reportedUser: { select: AUTHOR_SELECT },
          resolvedBy: { select: AUTHOR_SELECT },
          postId: true,
          reelId: true,
          postCommentId: true,
          reelCommentId: true,
          gameId: true,
          storyId: true,
          messageId: true,
          clubId: true,
          post: { select: { caption: true } },
          reel: { select: { caption: true } },
          postComment: { select: { content: true } },
          reelComment: { select: { content: true } },
          game: { select: { title: true } },
          club: { select: { name: true } },
          // Only the reported message is visible; unrelated private messages are never queried.
          message: { select: { content: true, deletedAt: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: PAGE_SIZE };
  }

  async updateReport(actorId: string, id: string, body: UpdateReportDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockAdminAccounts(tx);
      await this.assertActor(tx, actorId);
      const closed = body.status === 'RESOLVED' || body.status === 'DISMISSED';
      const report = await tx.report.findUnique({
        where: { id },
        select: { reporterId: true, reason: true },
      });
      if (!report) throw new NotFoundException('Report not found.');
      const result = await tx.report.updateMany({
        where: { id, status: body.expectedStatus },
        data: {
          status: body.status,
          resolvedById: closed ? actorId : null,
          resolvedAt: closed ? new Date() : null,
        },
      });
      if (!result.count) {
        if (!(await tx.report.count({ where: { id } })))
          throw new NotFoundException('Report not found.');
        throw new ConflictException(
          'This report was updated by another admin. Refresh and try again.',
        );
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'REPORT_STATUS_CHANGED',
          targetId: id,
          details: { before: body.expectedStatus, after: body.status },
        },
      });
      if (
        report.reason === 'HELP_REQUEST' &&
        body.status !== body.expectedStatus &&
        ['REVIEWING', 'RESOLVED', 'DISMISSED'].includes(body.status)
      ) {
        await tx.notification.create({
          data: {
            userId: report.reporterId,
            type: 'HELP_REQUEST_UPDATED',
            reportId: id,
            reportStatus: body.status,
          },
        });
      }
      return { id, status: body.status };
    });
  }

  sports() {
    return this.prisma.sport.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: { select: { players: true, games: true } },
      },
    });
  }

  async createSport(actorId: string, input: CreateSportDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockAdminAccounts(tx);
        await this.assertActor(tx, actorId);
        const sport = await tx.sport.create({
          data: {
            name: input.name,
            description: input.description ?? null,
          },
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            _count: { select: { players: true, games: true } },
          },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: 'SPORT_CREATED',
            targetId: sport.id,
            details: { name: sport.name, description: sport.description },
          },
        });
        return sport;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A sport with this name already exists.');
      }
      throw error;
    }
  }

  async updateSport(actorId: string, id: string, isActive: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await lockAdminAccounts(tx);
      await this.assertActor(tx, actorId);
      const before = await tx.sport.findUnique({
        where: { id },
        select: { isActive: true, name: true },
      });
      if (!before) throw new NotFoundException('Sport not found.');
      const sport = await tx.sport.update({
        where: { id },
        data: { isActive },
        select: { id: true, isActive: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'SPORT_STATUS_CHANGED',
          targetId: id,
          details: {
            name: before.name,
            before: before.isActive,
            after: isActive,
          },
        },
      });
      return sport;
    });
  }

  async audit(query: AdminPageQuery) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          action: true,
          targetId: true,
          details: true,
          createdAt: true,
          actor: { select: AUTHOR_SELECT },
        },
      }),
      this.prisma.adminAuditLog.count(),
    ]);
    return { items, total, page: query.page, pageSize: PAGE_SIZE };
  }

  private async assertActor(tx: Prisma.TransactionClient, id: string) {
    if (
      !(await tx.user.count({
        where: { id, role: 'SUPER_ADMIN', isActive: true },
      }))
    ) {
      throw new ForbiddenException('Super admin access is required.');
    }
  }
}
