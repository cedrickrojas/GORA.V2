import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { friendshipWithViewer } from '../posts/post-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import { ListNotificationsDto } from './notifications.dto';

const SELECT = {
  id: true,
  type: true,
  isRead: true,
  createdAt: true,
  gameId: true,
  postId: true,
  reelId: true,
  storyId: true,
  actor: { select: AUTHOR_SELECT },
  game: { select: { title: true } },
  badge: { select: { name: true } },
  post: { select: { deletedAt: true } },
  reel: { select: { deletedAt: true } },
  message: {
    select: {
      conversationId: true,
      deletedAt: true,
      conversation: { select: { clubId: true } },
    },
  },
} as const satisfies Prisma.NotificationSelect;
type Row = Prisma.NotificationGetPayload<{ select: typeof SELECT }>;

const CONTENT = {
  FRIEND_REQUEST: ['Friend request', 'sent you a friend request.'],
  FRIEND_ACCEPTED: ['Friend request accepted', 'accepted your friend request.'],
  GAME_JOIN_REQUEST: ['New join request', 'wants to join'],
  GAME_JOIN_ACCEPTED: ['Request accepted', 'accepted your request to join'],
  GAME_JOIN_REJECTED: ['Request declined', 'declined your request to join'],
  GAME_FULL: ['Game is full', 'Your game has filled all its spots.'],
  GAME_CANCELLED: ['Game cancelled', 'cancelled'],
  GAME_COMPLETED: ['Game completed', 'is complete.'],
  NEW_MESSAGE: ['New message', 'sent you a message.'],
  MESSAGE_REQUEST: ['Message request', 'wants to message you.'],
  POST_LIKE: ['Post liked', 'liked your post.'],
  POST_COMMENT: ['New comment', 'commented on your post.'],
  REEL_LIKE: ['Reel liked', 'liked your reel.'],
  REEL_COMMENT: ['New reel comment', 'commented on your reel.'],
  STORY_REPLY: ['Story reply', 'replied to your story.'],
  BADGE_UNLOCKED: ['Badge unlocked', 'You earned a new badge.'],
  LIVE_STARTED: ['Live now', 'started a live stream.'],
  NEW_FOLLOWER: ['New follower', 'started following you.'],
} as const;

/** Both list/count and writes are scoped to the recipient from the verified JWT. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private visibleTo(userId: string): Prisma.NotificationWhereInput {
    return {
      userId,
      OR: [
        { actorId: null },
        {
          actor: {
            is: {
              isActive: true,
              NOT: friendshipWithViewer(userId, 'BLOCKED'),
            },
          },
        },
      ],
    };
  }

  async list(userId: string, { limit, offset }: ListNotificationsDto) {
    const where = this.visibleTo(userId);
    const [rows, unreadCount, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({
        where: { AND: [where, { isRead: false }] },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items: rows.map(toView),
      unreadCount,
      hasMore: offset + rows.length < total,
      nextOffset: offset + rows.length,
    };
  }

  async markRead(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notification.updateMany({
        where: { id, AND: [this.visibleTo(userId)] },
        data: { isRead: true },
      });
      if (!updated.count)
        throw new NotFoundException('Notification not found.');
      const unreadCount = await tx.notification.count({
        where: { AND: [this.visibleTo(userId), { isRead: false }] },
      });
      return { id, read: true, unreadCount };
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.notification.updateMany({
        where: { AND: [this.visibleTo(userId), { isRead: false }] },
        data: { isRead: true },
      });
      const unreadCount = await tx.notification.count({
        where: { AND: [this.visibleTo(userId), { isRead: false }] },
      });
      return { updated: updated.count, unreadCount };
    });
  }
}

function toView(row: Row) {
  const actor = row.actor
    ? {
        id: row.actor.id,
        username: row.actor.username,
        displayName: formatDisplayName(row.actor),
        avatarUrl: row.actor.profileImageUrl,
      }
    : null;
  const name = actor?.displayName || 'Someone';
  const [title, action] = CONTENT[row.type];
  let body: string = `${name} ${action}`;
  let link: string | null = null;
  if (row.type.startsWith('GAME_')) {
    const game = row.game?.title || 'this game';
    body =
      row.type === 'GAME_FULL'
        ? `${game} has filled all its spots.`
        : row.type === 'GAME_COMPLETED'
          ? `${game} is complete.`
          : `${name} ${action} ${game}.`;
    if (row.gameId && row.game) link = `/games/${row.gameId}`;
  } else if (row.type === 'BADGE_UNLOCKED') {
    body = row.badge ? `You earned ${row.badge.name}.` : action;
    link = '/profile/badges';
  } else if (row.type === 'FRIEND_REQUEST')
    link = '/profile/friends?tab=requests';
  else if (row.type === 'FRIEND_ACCEPTED') link = '/profile/friends';
  else if (row.type === 'NEW_FOLLOWER')
    link = actor
      ? `/profile/${encodeURIComponent(actor.username)}`
      : '/profile/followers';
  else if (row.type === 'NEW_MESSAGE' && row.message && !row.message.deletedAt)
    link = row.message.conversation.clubId
      ? `/chat/clubs/${row.message.conversation.clubId}`
      : `/chat/${row.message.conversationId}`;
  else if (row.type === 'MESSAGE_REQUEST') link = '/chat?section=requests';
  else if (row.type.startsWith('POST_') && row.post && !row.post.deletedAt)
    link = `/posts/${row.postId}`;
  else if (row.type.startsWith('REEL_') && row.reel && !row.reel.deletedAt)
    link = '/profile/reels';
  else if (row.type === 'STORY_REPLY') link = '/chat';
  else if (row.type === 'LIVE_STARTED' && actor)
    link = `/profile/${encodeURIComponent(actor.username)}`;
  return {
    id: row.id,
    type: row.type,
    actor,
    title,
    body,
    createdAt: row.createdAt.toISOString(),
    read: row.isRead,
    link,
  };
}
