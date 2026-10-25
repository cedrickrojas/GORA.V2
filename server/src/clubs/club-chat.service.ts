import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClubMemberRole, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import type {
  ClubChatMessagesQueryDto,
  SendClubChatMessageDto,
} from './dto/club-chat.dto';
import { CLUB_CHAT_PAGE_DEFAULT } from './dto/club-chat.dto';
import type {
  ClubChatMessagePage,
  ClubChatMessageView,
  ClubChatView,
} from './club-chat.types';
import {
  clubChatPermissions,
  type ClubChatPermissions,
} from './club-permissions';

export const CLUB_NOT_FOUND_MESSAGE = 'Club not found.';
export const CLUB_CHAT_CLOSED_MESSAGE =
  'This club is no longer active, so its chat is closed.';
export const CLUB_CHAT_MEMBERS_ONLY_MESSAGE =
  "Only active club members can use this club's chat.";
export const CLUB_CHAT_PENDING_MESSAGE =
  "Your request to join hasn't been approved yet. The club chat opens once it is.";

const CLUB_SELECT = {
  id: true,
  slug: true,
  name: true,
  profileImageUrl: true,
  isPublic: true,
  isActive: true,
  sport: { select: { name: true } },
} as const satisfies Prisma.ClubSelect;

const CONVERSATION_SELECT = {
  id: true,
  type: true,
  clubId: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ConversationSelect;

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  content: true,
  messageType: true,
  createdAt: true,
  sender: { select: AUTHOR_SELECT },
} as const satisfies Prisma.MessageSelect;

type ClubRow = Prisma.ClubGetPayload<{ select: typeof CLUB_SELECT }>;
type ConversationRow = Prisma.ConversationGetPayload<{
  select: typeof CONVERSATION_SELECT;
}>;
type MessageRow = Prisma.MessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

interface Membership {
  role: ClubMemberRole;
  joinedAt: Date;
}

interface ClubChatAccess {
  club: ClubRow;
  membership: Membership;
  permissions: ClubChatPermissions;
  conversation: ConversationRow;
}

/**
 * The official club group chat. Every request re-derives access from the database:
 * the club exists and is active, the viewer is an ACTIVE member, and the conversation
 * is that club's CLUB conversation. Nothing in the request body picks the club,
 * conversation, or sender. There is deliberately no way to create a group chat here.
 */
@Injectable()
export class ClubChatService {
  constructor(private readonly prisma: PrismaService) {}

  /** The chats of every active club the viewer is an ACTIVE member of, most recent first. */
  async listForViewer(viewerId: string): Promise<ClubChatView[]> {
    const memberships = await this.prisma.clubMember.findMany({
      where: { userId: viewerId, status: 'ACTIVE', club: { isActive: true } },
      select: { role: true, joinedAt: true, club: { select: CLUB_SELECT } },
    });

    const views = await Promise.all(
      memberships.map(async ({ club, ...membership }) =>
        this.buildView(
          viewerId,
          club,
          membership,
          await this.officialChat(club.id),
        ),
      ),
    );

    return views.sort(
      (a, b) => lastActivity(b).getTime() - lastActivity(a).getTime(),
    );
  }

  async getChat(viewerId: string, clubId: string): Promise<ClubChatView> {
    const access = await this.requireAccess(viewerId, clubId, 'READ');

    return this.buildView(
      viewerId,
      access.club,
      access.membership,
      access.conversation,
    );
  }

  /** Newest page first (returned oldest to newest). Reading the newest page marks the chat read. */
  async listMessages(
    viewerId: string,
    clubId: string,
    query: ClubChatMessagesQueryDto,
  ): Promise<ClubChatMessagePage> {
    const { conversation } = await this.requireAccess(viewerId, clubId, 'READ');
    const take = query.limit ?? CLUB_CHAT_PAGE_DEFAULT;
    const rows = await this.prisma.message.findMany({
      where: { conversationId: conversation.id, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
      select: MESSAGE_SELECT,
    });
    const page = rows.slice(0, take);
    const nextCursor = rows.length > take ? page[page.length - 1].id : null;

    if (!query.before) {
      await this.markRead(conversation.id, viewerId, new Date());
    }

    return { messages: page.reverse().map(toMessageView), nextCursor };
  }

  async send(
    viewerId: string,
    clubId: string,
    dto: SendClubChatMessageDto,
  ): Promise<ClubChatMessageView> {
    const { conversation } = await this.requireAccess(viewerId, clubId, 'SEND');
    const now = new Date();

    try {
      const [message] = await this.prisma.$transaction([
        this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: viewerId,
            content: dto.content,
          },
          select: MESSAGE_SELECT,
        }),
        this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: now },
          select: { id: true },
        }),
        this.readStateUpsert(conversation.id, viewerId, now),
      ]);

      return toMessageView(message);
    } catch (error) {
      // The database refuses senders who stopped being ACTIVE members after the check
      // above; answer with the same 403 instead of a server error.
      await this.requireAccess(viewerId, clubId, 'SEND');
      throw error;
    }
  }

  private async requireAccess(
    viewerId: string,
    clubId: string,
    need: 'READ' | 'SEND',
  ): Promise<ClubChatAccess> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: CLUB_SELECT,
    });

    if (!club) {
      throw new NotFoundException(CLUB_NOT_FOUND_MESSAGE);
    }

    if (!club.isActive) {
      throw new ForbiddenException(CLUB_CHAT_CLOSED_MESSAGE);
    }

    const membership = await this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId: viewerId } },
      select: { role: true, status: true, joinedAt: true },
    });
    const permissions = clubChatPermissions(membership, club);
    const allowed = need === 'READ' ? permissions.canRead : permissions.canSend;

    if (!membership || !allowed) {
      throw new ForbiddenException(
        membership?.status === 'PENDING'
          ? CLUB_CHAT_PENDING_MESSAGE
          : CLUB_CHAT_MEMBERS_ONLY_MESSAGE,
      );
    }

    const conversation = await this.officialChat(club.id);

    if (conversation.type !== 'CLUB' || conversation.clubId !== club.id) {
      throw new ForbiddenException(CLUB_CHAT_MEMBERS_ONLY_MESSAGE);
    }

    return { club, membership, permissions, conversation };
  }

  /**
   * The club's one official chat. The Club_create_chat trigger creates it with the club;
   * if it is ever missing, it is created here, and the unique clubId keeps it single.
   */
  private async officialChat(clubId: string): Promise<ConversationRow> {
    const existing = await this.prisma.conversation.findUnique({
      where: { clubId },
      select: CONVERSATION_SELECT,
    });

    if (existing) {
      return existing;
    }

    await this.prisma.conversation.createMany({
      data: [{ type: 'CLUB', clubId }],
      skipDuplicates: true,
    });

    return this.prisma.conversation.findUniqueOrThrow({
      where: { clubId },
      select: CONVERSATION_SELECT,
    });
  }

  private async buildView(
    viewerId: string,
    club: ClubRow,
    membership: Membership,
    conversation: ConversationRow,
  ): Promise<ClubChatView> {
    const [memberCount, lastMessage, readState] = await Promise.all([
      this.prisma.clubMember.count({
        where: { clubId: club.id, status: 'ACTIVE' },
      }),
      this.prisma.message.findFirst({
        where: { conversationId: conversation.id, deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: MESSAGE_SELECT,
      }),
      this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: viewerId,
          },
        },
        select: { lastReadAt: true },
      }),
    ]);
    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        senderId: { not: viewerId },
        createdAt: { gt: readState?.lastReadAt ?? membership.joinedAt },
      },
    });

    return {
      id: conversation.id,
      type: 'CLUB',
      club: {
        id: club.id,
        slug: club.slug,
        name: club.name,
        sport: club.sport?.name ?? null,
        profileImageUrl: club.profileImageUrl,
        isPublic: club.isPublic,
      },
      memberCount,
      viewer: {
        role: membership.role,
        permissions: clubChatPermissions(
          { role: membership.role, status: 'ACTIVE' },
          club,
        ),
      },
      lastMessage: lastMessage ? toMessageView(lastMessage) : null,
      unreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * ConversationParticipant only stores read state for club chats. The system writes it
   * for the member themself; a database trigger refuses anyone who is not ACTIVE.
   */
  private readStateUpsert(conversationId: string, userId: string, at: Date) {
    return this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, lastReadAt: at },
      update: { lastReadAt: at },
      select: { id: true },
    });
  }

  private async markRead(
    conversationId: string,
    userId: string,
    at: Date,
  ): Promise<void> {
    await this.readStateUpsert(conversationId, userId, at);
  }
}

function toMessageView(message: MessageRow): ClubChatMessageView {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: {
      id: message.sender.id,
      username: message.sender.username,
      displayName: formatDisplayName(message.sender),
      profileImageUrl: message.sender.profileImageUrl,
    },
    content: message.content,
    messageType: message.messageType,
    createdAt: message.createdAt,
  };
}

function lastActivity(view: ClubChatView): Date {
  return view.lastMessage?.createdAt ?? view.createdAt;
}
