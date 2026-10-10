import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DirectChatService } from './direct-chat.service';
import { AUTHOR_SELECT } from '../users/user.types';
import { formatDisplayName } from '../users/display-name';
import type { CallCandidateDto } from './direct-call.dto';

const ACTIVE = ['RINGING', 'ACTIVE'];
const include = {
  caller: { select: AUTHOR_SELECT },
  callee: { select: AUTHOR_SELECT },
} as const;

@Injectable()
export class DirectCallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: DirectChatService,
  ) {}

  private async expire() {
    const now = new Date();
    await this.prisma.directCall.updateMany({
      where: {
        status: 'RINGING',
        createdAt: { lt: new Date(Date.now() - 45_000) },
      },
      data: {
        status: 'MISSED',
        endedAt: now,
        offer: '',
        answer: null,
        callerCandidates: [],
        calleeCandidates: [],
      },
    });
    await this.prisma.directCall.updateMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { callerSeenAt: { lt: new Date(Date.now() - 60_000) } },
          { calleeSeenAt: { lt: new Date(Date.now() - 60_000) } },
        ],
      },
      data: {
        status: 'ENDED',
        endedAt: now,
        offer: '',
        answer: null,
        callerCandidates: [],
        calleeCandidates: [],
      },
    });
  }

  async start(
    viewerId: string,
    conversationId: string,
    mode: 'AUDIO' | 'VIDEO',
    offer: string,
  ) {
    const conversation = await this.chat.requireConversation(
      viewerId,
      conversationId,
    );
    const calleeId = conversation.participants.find(
      (p) => p.userId !== viewerId,
    )!.userId;
    await this.expire();
    const call = await this.prisma.$transaction(
      async (tx) => {
        for (const userId of [viewerId, calleeId].sort())
          await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${userId}))`;
        const busy = await tx.directCall.findFirst({
          where: {
            status: { in: ACTIVE },
            OR: [
              { callerId: { in: [viewerId, calleeId] } },
              { calleeId: { in: [viewerId, calleeId] } },
            ],
          },
          select: { id: true },
        });
        if (busy)
          throw new ConflictException('One of you is already in a call.');
        return tx.directCall.create({
          data: { conversationId, callerId: viewerId, calleeId, mode, offer },
          include,
        });
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
    return this.present(call);
  }

  async incoming(viewerId: string) {
    await this.expire();
    const row = await this.prisma.directCall.findFirst({
      where: { calleeId: viewerId, status: 'RINGING' },
      include,
    });
    if (!row) return { call: null };
    try {
      await this.chat.requireConversation(viewerId, row.conversationId);
    } catch {
      return { call: null };
    }
    return { call: this.present(row) };
  }

  private async require(viewerId: string, id: string) {
    const row = await this.prisma.directCall.findFirst({
      where: { id, OR: [{ callerId: viewerId }, { calleeId: viewerId }] },
      include,
    });
    if (!row) throw new NotFoundException('Call not found.');
    await this.chat.requireConversation(viewerId, row.conversationId);
    return row;
  }

  async get(viewerId: string, id: string) {
    await this.expire();
    const row = await this.require(viewerId, id);
    if (ACTIVE.includes(row.status))
      await this.prisma.directCall.updateMany({
        where: { id, status: { in: ACTIVE } },
        data:
          viewerId === row.callerId
            ? { callerSeenAt: new Date() }
            : { calleeSeenAt: new Date() },
      });
    return this.present(row);
  }

  async answer(viewerId: string, id: string, answer: string) {
    await this.expire();
    const row = await this.require(viewerId, id);
    if (row.calleeId !== viewerId)
      throw new ForbiddenException('Only the recipient can answer.');
    const changed = await this.prisma.directCall.updateMany({
      where: { id, status: 'RINGING' },
      data: {
        answer,
        status: 'ACTIVE',
        answeredAt: new Date(),
        calleeSeenAt: new Date(),
      },
    });
    if (!changed.count)
      throw new ConflictException(
        'This call has already ended or been answered.',
      );
    return this.get(viewerId, id);
  }

  async candidate(viewerId: string, id: string, candidate: CallCandidateDto) {
    const row = await this.require(viewerId, id);
    if (!ACTIVE.includes(row.status))
      throw new ConflictException('This call has ended.');
    const key =
      viewerId === row.callerId ? 'callerCandidates' : 'calleeCandidates';
    if (row[key].length >= 64)
      throw new ConflictException('Too many connection candidates.');
    await this.prisma.directCall.updateMany({
      where: { id, status: { in: ACTIVE } },
      data: { [key]: { push: JSON.stringify(candidate) } },
    });
    return { saved: true };
  }

  async end(viewerId: string, id: string) {
    const row = await this.require(viewerId, id);
    await this.prisma.directCall.updateMany({
      where: { id, status: { in: ACTIVE } },
      data: {
        status:
          row.status === 'RINGING' && row.calleeId === viewerId
            ? 'DECLINED'
            : 'ENDED',
        endedAt: new Date(),
        offer: '',
        answer: null,
        callerCandidates: [],
        calleeCandidates: [],
      },
    });
    return { ended: true };
  }

  private present(row: Awaited<ReturnType<DirectCallService['require']>>) {
    const person = (user: typeof row.caller) => ({
      id: user.id,
      username: user.username,
      displayName: formatDisplayName(user),
      avatarUrl: user.profileImageUrl,
    });
    return {
      id: row.id,
      conversationId: row.conversationId,
      caller: person(row.caller),
      callee: person(row.callee),
      mode: row.mode as 'AUDIO' | 'VIDEO',
      status: row.status,
      offer: row.offer,
      answer: row.answer,
      callerCandidates: row.callerCandidates.map(
        (s) => JSON.parse(s) as unknown,
      ),
      calleeCandidates: row.calleeCandidates.map(
        (s) => JSON.parse(s) as unknown,
      ),
      createdAt: row.createdAt,
      answeredAt: row.answeredAt,
    };
  }
}
