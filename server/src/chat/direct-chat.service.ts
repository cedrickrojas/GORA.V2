import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClubChatMessagesQueryDto } from '../clubs/dto/club-chat.dto';
import { friendshipWithViewer } from '../posts/post-visibility';
import { RelationshipService } from '../social/relationship.service';
import { toPairKey } from '../social/relationship';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  createdAt: true,
  sender: { select: AUTHOR_SELECT },
} satisfies Prisma.MessageSelect;
const CONVERSATION_SELECT = {
  id: true,
  updatedAt: true,
  participants: {
    select: { userId: true, lastReadAt: true, user: { select: AUTHOR_SELECT } },
  },
  messages: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: MESSAGE_SELECT,
  },
} satisfies Prisma.ConversationSelect;
type ConversationRow = Prisma.ConversationGetPayload<{
  select: typeof CONVERSATION_SELECT;
}>;
type MessageRow = Prisma.MessageGetPayload<{ select: typeof MESSAGE_SELECT }>;
type Person = Prisma.UserGetPayload<{ select: typeof AUTHOR_SELECT }>;
const person = (user: Person) => ({
  id: user.id,
  username: user.username,
  displayName: formatDisplayName(user),
  avatarUrl: user.profileImageUrl,
});
const messageView = (row: MessageRow) => ({
  id: row.id,
  conversationId: row.conversationId,
  senderId: row.senderId,
  sender: person(row.sender),
  body: row.content,
  sentAt: row.createdAt,
});

/** Every response is built for its authenticated viewer; sender identity is never accepted from the client. */
@Injectable()
export class DirectChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationships: RelationshipService,
  ) {}

  private visibleWhere(viewerId: string): Prisma.ConversationWhereInput {
    return {
      type: 'DIRECT',
      participants: {
        some: { userId: viewerId },
        every: {
          user: {
            isActive: true,
            NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
          },
        },
      },
    };
  }

  async list(viewerId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: this.visibleWhere(viewerId),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: CONVERSATION_SELECT,
    });
    return Promise.all(rows.map((row) => this.summary(row, viewerId)));
  }

  async get(viewerId: string, conversationId: string) {
    return this.summary(
      await this.requireConversation(viewerId, conversationId),
      viewerId,
    );
  }

  async open(viewerId: string, recipientId: string) {
    const relationship = await this.requireRecipient(viewerId, recipientId);
    const key = toPairKey(viewerId, recipientId);
    const existing = await this.prisma.conversation.findUnique({
      where: { directKey: key },
      select: { id: true },
    });
    if (existing) return this.get(viewerId, existing.id);
    if (relationship !== 'FRIENDS')
      throw new ForbiddenException(
        'Send a message request first and wait for them to accept.',
      );
    try {
      const row = await this.ensureConversation(
        this.prisma,
        viewerId,
        recipientId,
      );
      return this.get(viewerId, row.id);
    } catch (error) {
      // Concurrent opens may both observe no row before the unique pair key is inserted.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const row = await this.prisma.conversation.findUniqueOrThrow({
          where: { directKey: key },
          select: { id: true },
        });
        return this.get(viewerId, row.id);
      }
      throw error;
    }
  }

  async messages(
    viewerId: string,
    conversationId: string,
    query: ClubChatMessagesQueryDto,
  ) {
    const readThrough = new Date();
    await this.requireConversation(viewerId, conversationId);
    if (
      query.before &&
      !(await this.prisma.message.findFirst({
        where: { id: query.before, conversationId, deletedAt: null },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Invalid message cursor.');
    const take = query.limit ?? 50;
    const rows = await this.prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
      select: MESSAGE_SELECT,
    });
    if (!query.before)
      await this.markRead(viewerId, conversationId, readThrough);
    const page = rows.slice(0, take);
    return {
      messages: page.reverse().map(messageView),
      nextCursor: rows.length > take ? rows[take - 1].id : null,
    };
  }

  async send(viewerId: string, conversationId: string, body: string) {
    await this.requireConversation(viewerId, conversationId);
    const row = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const message = await tx.message.create({
        data: { conversationId, senderId: viewerId, content: body },
        select: MESSAGE_SELECT,
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: message.createdAt },
      });
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: viewerId } },
        data: { lastReadAt: now },
      });
      return message;
    });
    return messageView(row);
  }

  async read(viewerId: string, conversationId: string) {
    const now = new Date();
    await this.requireConversation(viewerId, conversationId);
    await this.markRead(viewerId, conversationId, now);
    return { read: true };
  }

  async requests(viewerId: string) {
    const rows = await this.prisma.messageRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [{ senderId: viewerId }, { receiverId: viewerId }],
        sender: {
          isActive: true,
          NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
        },
        receiver: {
          isActive: true,
          NOT: friendshipWithViewer(viewerId, 'BLOCKED'),
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        sender: { select: AUTHOR_SELECT },
        receiver: { select: AUTHOR_SELECT },
        initialMessage: true,
        createdAt: true,
      },
    });
    return {
      received: rows
        .filter((row) => row.receiverId === viewerId)
        .map((row) => ({
          id: row.id,
          sender: person(row.sender),
          initialMessage: row.initialMessage,
          createdAt: row.createdAt,
        })),
      sent: rows
        .filter((row) => row.senderId === viewerId)
        .map((row) => ({
          id: row.id,
          recipient: person(row.receiver),
          initialMessage: row.initialMessage,
          createdAt: row.createdAt,
        })),
    };
  }

  async request(viewerId: string, recipientId: string, body: string) {
    const relationship = await this.requireRecipient(viewerId, recipientId);
    if (relationship === 'FRIENDS')
      throw new ConflictException(
        'You are now friends. Open their profile to start a direct chat.',
      );
    const pairKey = toPairKey(viewerId, recipientId);
    if (
      await this.prisma.conversation.findUnique({
        where: { directKey: pairKey },
        select: { id: true },
      })
    )
      throw new ConflictException(
        'You already have a chat with this person. Open it from Messages.',
      );
    try {
      const row = await this.prisma.messageRequest.create({
        data: {
          senderId: viewerId,
          receiverId: recipientId,
          pairKey,
          initialMessage: body,
        },
        select: {
          id: true,
          receiver: { select: AUTHOR_SELECT },
          initialMessage: true,
          createdAt: true,
        },
      });
      return {
        id: row.id,
        recipient: person(row.receiver),
        initialMessage: row.initialMessage,
        createdAt: row.createdAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'A message request already exists between these accounts.',
        );
      throw error;
    }
  }

  async accept(viewerId: string, requestId: string) {
    const request = await this.prisma.messageRequest.findFirst({
      where: { id: requestId, receiverId: viewerId },
      select: {
        senderId: true,
        status: true,
        conversationId: true,
        initialMessage: true,
      },
    });
    if (!request) throw new NotFoundException('Message request not found.');
    await this.requireRecipient(viewerId, request.senderId);
    if (request.status === 'ACCEPTED' && request.conversationId)
      return this.get(viewerId, request.conversationId);
    if (request.status !== 'PENDING')
      throw new ConflictException('This message request is no longer pending.');
    const conversationId = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.messageRequest.updateMany({
        where: { id: requestId, receiverId: viewerId, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (!claimed.count)
        throw new ConflictException(
          'This message request has already been handled.',
        );
      const conversation = await this.ensureConversation(
        tx,
        viewerId,
        request.senderId,
      );
      const initial = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: request.senderId,
          content: request.initialMessage,
        },
        select: { createdAt: true },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: initial.createdAt },
      });
      await tx.messageRequest.update({
        where: { id: requestId },
        data: { conversationId: conversation.id },
      });
      return conversation.id;
    });
    return this.get(viewerId, conversationId);
  }

  async reject(viewerId: string, requestId: string) {
    const result = await this.prisma.messageRequest.updateMany({
      where: { id: requestId, receiverId: viewerId, status: 'PENDING' },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException('Message request not found.');
    return { deleted: true };
  }

  async recipient(viewerId: string, recipientId: string) {
    await this.requireRecipient(viewerId, recipientId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: recipientId },
      select: AUTHOR_SELECT,
    });
    return person(user);
  }

  private async requireRecipient(viewerId: string, recipientId: string) {
    if (viewerId === recipientId)
      throw new BadRequestException('You cannot message yourself.');
    const exists = await this.prisma.user.findFirst({
      where: { id: recipientId, isActive: true },
      select: { id: true },
    });
    const relationship = exists
      ? await this.relationships.between(viewerId, recipientId)
      : null;
    if (
      !exists ||
      !relationship ||
      relationship === 'BLOCKED' ||
      relationship === 'BLOCKED_BY_THEM'
    )
      throw new NotFoundException('User not found.');
    return relationship;
  }

  private async requireConversation(viewerId: string, conversationId: string) {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, ...this.visibleWhere(viewerId) },
      select: CONVERSATION_SELECT,
    });
    if (!row || row.participants.length !== 2)
      throw new NotFoundException('Conversation not found.');
    return row;
  }

  private async ensureConversation(
    tx: Prisma.TransactionClient,
    a: string,
    b: string,
  ) {
    return tx.conversation.upsert({
      where: { directKey: toPairKey(a, b) },
      create: {
        type: 'DIRECT',
        directKey: toPairKey(a, b),
        participants: { create: [{ userId: a }, { userId: b }] },
      },
      update: {},
      select: { id: true },
    });
  }

  private async markRead(
    viewerId: string,
    conversationId: string,
    through: Date,
  ) {
    await this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId: viewerId,
        OR: [{ lastReadAt: null }, { lastReadAt: { lt: through } }],
      },
      data: { lastReadAt: through },
    });
  }

  private async summary(row: ConversationRow, viewerId: string) {
    const partner = row.participants.find(
      (participant) => participant.userId !== viewerId,
    )!;
    const viewer = row.participants.find(
      (participant) => participant.userId === viewerId,
    )!;
    const latest = row.messages[0];
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: row.id,
        senderId: { not: viewerId },
        deletedAt: null,
        ...(viewer.lastReadAt ? { createdAt: { gt: viewer.lastReadAt } } : {}),
      },
    });
    return {
      id: row.id,
      type: 'DIRECT' as const,
      partner: person(partner.user),
      lastMessage: latest?.content ?? '',
      lastMessageSenderId: latest?.senderId ?? null,
      lastMessageAt: latest?.createdAt ?? row.updatedAt,
      unreadCount,
    };
  }
}
