import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RelationshipService } from '../social/relationship.service';
import { AUTHOR_SELECT } from '../users/user.types';
import { formatDisplayName } from '../users/display-name';

const HOST_TIMEOUT = 45_000;
const VIEWER_TIMEOUT = 30_000;
const MAX_VIEWERS = 10;
const include = {
  host: { select: AUTHOR_SELECT },
  _count: { select: { viewers: { where: { leftAt: null } } } },
} as const;

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationships: RelationshipService,
    private readonly settings: ConfigService,
  ) {}

  config(userId: string) {
    const iceServers: {
      urls: string[];
      username?: string;
      credential?: string;
    }[] = [];
    const stun = this.settings
      .get<string>('LIVE_STUN_URLS', 'stun:stun.l.google.com:19302')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (stun.length) iceServers.push({ urls: stun });
    const urls = this.settings
      .get<string>('LIVE_TURN_URLS', '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const secret = this.settings.get<string>('LIVE_TURN_SECRET', '');
    if (urls.length && secret) {
      const username = `${Math.floor(Date.now() / 1000) + 86400}:${userId}`;
      iceServers.push({
        urls,
        username,
        credential: createHmac('sha1', secret)
          .update(username)
          .digest('base64'),
      });
    }
    return { iceServers, maxViewers: MAX_VIEWERS };
  }

  private async expire() {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.liveStream.updateMany({
        where: {
          status: 'LIVE',
          updatedAt: { lt: new Date(Date.now() - HOST_TIMEOUT) },
        },
        data: { status: 'ENDED', endedAt: now },
      });
      await tx.liveViewer.updateMany({
        where: {
          leftAt: null,
          OR: [
            { lastSeenAt: { lt: new Date(Date.now() - VIEWER_TIMEOUT) } },
            { liveStream: { status: { not: 'LIVE' } } },
          ],
        },
        data: { leftAt: now, offer: null, answer: null },
      });
    });
  }

  async list(userId: string) {
    await this.expire();
    const rows = await this.prisma.liveStream.findMany({
      where: { status: 'LIVE', host: { isActive: true } },
      include,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    const blocked = new Set(
      await this.relationships.blockedAmong(
        userId,
        rows.map((row) => row.hostId),
      ),
    );
    return rows
      .filter((row) => !blocked.has(row.hostId))
      .map((row) => this.present(row));
  }

  async mine(userId: string) {
    await this.expire();
    const row = await this.prisma.liveStream.findFirst({
      where: { hostId: userId, status: 'LIVE' },
      include,
    });
    return { live: row ? this.present(row) : null };
  }

  private present(row: Awaited<ReturnType<LiveService['read']>>) {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      viewerCount: row._count.viewers,
      host: {
        id: row.host.id,
        username: row.host.username,
        displayName: formatDisplayName(row.host),
        avatarUrl: row.host.profileImageUrl,
      },
    };
  }

  private async read(id: string) {
    const row = await this.prisma.liveStream.findUnique({
      where: { id, host: { isActive: true } },
      include,
    });
    if (!row) throw new NotFoundException('Live stream not found.');
    return row;
  }

  private async access(userId: string, id: string, hostOnly = false) {
    const row = await this.read(id);
    if (hostOnly && row.hostId !== userId)
      throw new ForbiddenException('Only the host can manage this live.');
    const relation = await this.relationships.between(userId, row.hostId);
    if (relation === 'BLOCKED' || relation === 'BLOCKED_BY_THEM')
      throw new ForbiddenException('This live is unavailable.');
    return row;
  }

  async get(userId: string, id: string) {
    await this.expire();
    return this.present(await this.access(userId, id));
  }

  async start(userId: string, title: string) {
    await this.expire();
    try {
      return this.present(
        await this.prisma.liveStream.create({
          data: {
            hostId: userId,
            title,
            status: 'LIVE',
            startedAt: new Date(),
          },
          include,
        }),
      );
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'You already have an active live. End it before starting another.',
        );
      throw error;
    }
  }

  async end(userId: string, id: string) {
    await this.access(userId, id, true);
    await this.prisma.$transaction(async (tx) => {
      await tx.liveStream.update({
        where: { id },
        data: { status: 'ENDED', endedAt: new Date() },
      });
      await tx.liveViewer.updateMany({
        where: { liveStreamId: id, leftAt: null },
        data: { leftAt: new Date(), offer: null, answer: null },
      });
    });
    return { ended: true };
  }

  async peers(userId: string, id: string) {
    await this.expire();
    await this.access(userId, id, true);
    const live = await this.prisma.liveStream.updateMany({
      where: { id, status: 'LIVE' },
      data: { updatedAt: new Date() },
    });
    if (!live.count) throw new GoneException('This live has ended.');
    const rows = await this.prisma.liveViewer.findMany({
      where: { liveStreamId: id, leftAt: null, user: { isActive: true } },
      select: { id: true, userId: true, offer: true, answer: true },
    });
    const blocked = await this.relationships.blockedAmong(
      userId,
      rows.map((row) => row.userId),
    );
    if (blocked.length)
      await this.prisma.liveViewer.updateMany({
        where: { liveStreamId: id, userId: { in: blocked }, leftAt: null },
        data: { leftAt: new Date(), offer: null, answer: null },
      });
    return rows.filter((row) => !blocked.includes(row.userId));
  }

  async join(userId: string, id: string) {
    await this.expire();
    const live = await this.access(userId, id);
    if (live.hostId === userId)
      throw new ConflictException('You are the host of this live.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "LiveStream" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const current = await tx.liveStream.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'LIVE')
        throw new GoneException('This live has ended.');
      await tx.liveViewer.updateMany({
        where: { liveStreamId: id, userId, leftAt: null },
        data: { leftAt: new Date(), offer: null, answer: null },
      });
      if (
        (await tx.liveViewer.count({
          where: { liveStreamId: id, leftAt: null },
        })) >= MAX_VIEWERS
      )
        throw new ConflictException(
          'This live is full. Try again when a viewer leaves.',
        );
      return tx.liveViewer.create({
        data: { liveStreamId: id, userId },
        select: { id: true },
      });
    });
  }

  private async peer(
    userId: string,
    id: string,
    peerId: string,
    hostOnly = false,
  ) {
    const live = await this.access(userId, id, hostOnly);
    if (live.status !== 'LIVE') throw new GoneException('This live has ended.');
    const peer = await this.prisma.liveViewer.findUnique({
      where: { id: peerId, liveStreamId: id, leftAt: null },
    });
    if (!peer)
      throw new GoneException(
        'Your viewing session has ended. Reconnect to watch.',
      );
    if (!hostOnly && peer.userId !== userId)
      throw new ForbiddenException(
        'This viewing session belongs to another user.',
      );
    if (hostOnly) {
      const blocked = await this.relationships.blockedAmong(userId, [
        peer.userId,
      ]);
      if (blocked.length)
        throw new ForbiddenException('This viewer is unavailable.');
    }
    return peer;
  }

  async poll(userId: string, id: string, peerId: string) {
    await this.expire();
    await this.peer(userId, id, peerId);
    const updated = await this.prisma.liveViewer.updateMany({
      where: { id: peerId, leftAt: null, liveStream: { status: 'LIVE' } },
      data: { lastSeenAt: new Date() },
    });
    if (!updated.count)
      throw new GoneException('This viewing session has ended.');
    const row = await this.prisma.liveViewer.findUnique({
      where: { id: peerId, leftAt: null },
      select: { id: true, offer: true, answer: true },
    });
    if (!row) throw new GoneException('This viewing session has ended.');
    return row;
  }

  async leave(userId: string, id: string, peerId: string) {
    const peer = await this.prisma.liveViewer.findUnique({
      where: { id: peerId, liveStreamId: id },
    });
    if (!peer || peer.userId !== userId)
      throw new ForbiddenException(
        'This viewing session belongs to another user.',
      );
    await this.prisma.liveViewer.updateMany({
      where: { id: peerId, leftAt: null },
      data: { leftAt: new Date(), offer: null, answer: null },
    });
    return { left: true };
  }

  async signal(
    userId: string,
    id: string,
    peerId: string,
    kind: 'offer' | 'answer',
    sdp: string,
  ) {
    await this.expire();
    const peer = await this.peer(userId, id, peerId, kind === 'offer');
    if (kind === 'answer' && !peer.offer)
      throw new ConflictException('Wait for the host before answering.');
    // Each connection negotiates once. Reconnect creates a fresh peer session.
    if (peer[kind] && peer[kind] !== sdp)
      throw new ConflictException('Reconnect before negotiating again.');
    const saved = await this.prisma.liveViewer.updateMany({
      where: { id: peerId, leftAt: null, liveStream: { status: 'LIVE' } },
      data: { [kind]: sdp },
    });
    if (!saved.count)
      throw new GoneException('This viewing session has ended.');
    return { saved: true };
  }
}
