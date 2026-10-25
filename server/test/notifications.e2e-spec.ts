import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { addDays, localMoment } from '../src/games/game-schedule';
import { toPairKey } from '../src/social/relationship';

type User = { id: string; token: string };
describe('Notification inbox and activity triggers (real database)', () => {
  let app: INestApplication<App>,
    prisma: PrismaService,
    host: User,
    player: User,
    stranger: User;
  let sportId: string,
    gameId: string,
    requestId: string,
    notificationId: string;
  const users: string[] = [];
  const conversations: string[] = [],
    badges: string[] = [];
  const suffix = randomBytes(5).toString('hex');
  const http = () => request(app.getHttpServer());
  const auth = (user: User) => ({ Authorization: `Bearer ${user.token}` });
  const inbox = (user: User, query = '') =>
    http()
      .get('/api/v1/notifications' + query)
      .set(auth(user));
  async function register(name: string): Promise<User> {
    const response = await http()
      .post('/api/v1/auth/register')
      .send({
        username: `notif_${name}_${suffix}`,
        email: `notif_${name}_${suffix}@example.test`,
        password: `Pw-${randomBytes(12).toString('hex')}`,
        firstName: 'Notification',
        lastName: name,
      })
      .expect(201);
    const body = response.body as { user: { id: string }; accessToken: string };
    users.push(body.user.id);
    return { id: body.user.id, token: body.accessToken };
  }
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    host = await register('host');
    player = await register('player');
    stranger = await register('stranger');
    sportId = (
      await prisma.sport.create({
        data: { name: `Notification sport ${suffix}` },
      })
    ).id;
    const response = await http()
      .post('/api/v1/games')
      .set(auth(host))
      .send({
        sportId,
        title: 'Notification test run',
        requiredPlayers: 2,
        gameDate: addDays(localMoment('Asia/Manila').date, 3),
        startTime: '18:00',
        endTime: '20:00',
        locationName: 'Test Court',
      })
      .expect(201);
    gameId = (response.body as { id: string }).id;
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.message.deleteMany({ where: { senderId: { in: users } } });
      await prisma.conversation.deleteMany({
        where: { id: { in: conversations } },
      });
      await prisma.reelLike.deleteMany({ where: { userId: { in: users } } });
      await prisma.reelComment.deleteMany({ where: { userId: { in: users } } });
      await prisma.reel.deleteMany({ where: { userId: { in: users } } });
      await prisma.userBadge.deleteMany({ where: { userId: { in: users } } });
      await prisma.badge.deleteMany({ where: { id: { in: badges } } });
      await prisma.postLike.deleteMany({ where: { userId: { in: users } } });
      await prisma.postComment.deleteMany({ where: { userId: { in: users } } });
      await prisma.post.deleteMany({ where: { userId: { in: users } } });
      await prisma.gameParticipant.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.joinRequest.deleteMany({ where: { userId: { in: users } } });
      await prisma.game.deleteMany({ where: { hostId: { in: users } } });
      await prisma.friendship.deleteMany({
        where: {
          OR: [{ requesterId: { in: users } }, { receiverId: { in: users } }],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      if (sportId) await prisma.sport.delete({ where: { id: sportId } });
    }
    await app?.close();
  });
  it('protects every inbox route and rejects invalid pagination and IDs', async () => {
    await http().get('/api/v1/notifications').expect(401);
    await http().patch('/api/v1/notifications/read-all').expect(401);
    await http()
      .patch('/api/v1/notifications/' + host.id + '/read')
      .expect(401);
    await inbox(host, '?limit=0').expect(400);
    await inbox(host, '?offset=-1').expect(400);
    await http()
      .patch('/api/v1/notifications/not-an-id/read')
      .set(auth(host))
      .expect(400);
    expect((await inbox(host).expect(200)).body).toMatchObject({
      items: [],
      unreadCount: 0,
    });
  });
  it('creates a host notification only for a successful new join request', async () => {
    const result = await http()
      .post(`/api/v1/games/${gameId}/join-requests`)
      .set(auth(player))
      .send({})
      .expect(201);
    requestId = (result.body as { id: string }).id;
    const resultInbox = (await inbox(host).expect(200)).body;
    expect(resultInbox.unreadCount).toBe(1);
    expect(resultInbox.items).toHaveLength(1);
    expect(resultInbox.items[0]).toMatchObject({
      type: 'GAME_JOIN_REQUEST',
      read: false,
      link: `/games/${gameId}`,
      actor: { id: player.id },
    });
    expect(JSON.stringify(resultInbox)).not.toMatch(
      /passwordHash|@example.test|accessToken/,
    );
    notificationId = resultInbox.items[0].id;
    await http()
      .post(`/api/v1/games/${gameId}/join-requests`)
      .set(auth(player))
      .send({})
      .expect(409);
    expect((await inbox(host)).body.unreadCount).toBe(1);
    expect((await inbox(stranger)).body.items).toEqual([]);
  });
  it('keeps read state in the database and prevents another user from marking it', async () => {
    await http()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(auth(stranger))
      .expect(404);
    expect(
      (
        await prisma.notification.findUniqueOrThrow({
          where: { id: notificationId },
        })
      ).isRead,
    ).toBe(false);
    await http()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(auth(host))
      .expect(200);
    await http()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(auth(host))
      .expect(200);
    const saved = (await inbox(host)).body;
    expect(saved.unreadCount).toBe(0);
    expect(saved.items[0].read).toBe(true);
  });
  it('notifies the player of acceptance and cancellation with working game links', async () => {
    await http()
      .patch(`/api/v1/games/${gameId}/join-requests/${requestId}/accept`)
      .set(auth(host))
      .expect(200);
    expect((await inbox(player)).body.items[0]).toMatchObject({
      type: 'GAME_JOIN_ACCEPTED',
      link: `/games/${gameId}`,
    });
    await http()
      .patch(`/api/v1/games/${gameId}/cancel`)
      .set(auth(host))
      .expect(200);
    expect((await inbox(player)).body.items[0]).toMatchObject({
      type: 'GAME_CANCELLED',
      link: `/games/${gameId}`,
    });
  });
  it('generates post likes/comments and follow/friend activity without self-notifications', async () => {
    const post = await prisma.post.create({
      data: { userId: host.id, caption: 'Ready for the next run.' },
    });
    const before = (await inbox(host)).body.unreadCount;
    await prisma.postLike.create({
      data: { postId: post.id, userId: host.id },
    });
    expect((await inbox(host)).body.unreadCount).toBe(before);
    await prisma.postLike.create({
      data: { postId: post.id, userId: player.id },
    });
    await prisma.postComment.create({
      data: { postId: post.id, userId: player.id, content: 'Game on!' },
    });
    await prisma.userFollow.create({
      data: { followerId: player.id, followingId: host.id },
    });
    await prisma.friendship.create({
      data: {
        requesterId: player.id,
        receiverId: host.id,
        pairKey: toPairKey(player.id, host.id),
      },
    });
    expect(
      (await inbox(host)).body.items.map((item: { type: string }) => item.type),
    ).toEqual(
      expect.arrayContaining([
        'POST_LIKE',
        'POST_COMMENT',
        'NEW_FOLLOWER',
        'FRIEND_REQUEST',
      ]),
    );
    await prisma.friendship.update({
      where: { pairKey: toPairKey(player.id, host.id) },
      data: { status: 'BLOCKED', blockedById: host.id },
    });
    expect(
      (await inbox(host)).body.items.every(
        (item: { actor: { id: string } | null }) =>
          item.actor?.id !== player.id,
      ),
    ).toBe(true);
    const count = await prisma.notification.count({
      where: { userId: host.id },
    });
    await prisma.postComment.create({
      data: { postId: post.id, userId: player.id, content: 'Blocked activity' },
    });
    expect(
      await prisma.notification.count({ where: { userId: host.id } }),
    ).toBe(count);
  });
  it('delivers message, reel, badge, and friendship acceptance notifications', async () => {
    const reel = await prisma.reel.create({
      data: {
        userId: host.id,
        videoUrl: 'https://example.test/notification-check.mp4',
      },
    });
    await prisma.reelLike.create({
      data: { reelId: reel.id, userId: stranger.id },
    });
    await prisma.reelComment.create({
      data: { reelId: reel.id, userId: stranger.id, content: 'Nice game!' },
    });
    const friendship = await prisma.friendship.create({
      data: {
        requesterId: host.id,
        receiverId: stranger.id,
        pairKey: toPairKey(host.id, stranger.id),
      },
    });
    await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'ACCEPTED' },
    });
    const conversation = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        directKey: toPairKey(host.id, stranger.id),
        participants: {
          create: [{ userId: host.id }, { userId: stranger.id }],
        },
      },
    });
    conversations.push(conversation.id);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: stranger.id,
        content: 'Ready for the game?',
      },
    });
    const badge = await prisma.badge.create({
      data: {
        name: 'Notification badge ' + suffix,
        description: 'Verification fixture',
        category: 'GAMES',
        requirement: 'GAMES_JOINED',
        target: 1,
      },
    });
    badges.push(badge.id);
    await prisma.userBadge.create({
      data: {
        userId: host.id,
        badgeId: badge.id,
        unlocked: true,
        unlockedAt: new Date(),
      },
    });
    const items = (await inbox(host)).body.items;
    expect(items.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining([
        'REEL_LIKE',
        'REEL_COMMENT',
        'FRIEND_ACCEPTED',
        'NEW_MESSAGE',
        'BADGE_UNLOCKED',
      ]),
    );
    expect(
      items.find((item: { type: string }) => item.type === 'NEW_MESSAGE').link,
    ).toBe('/chat/' + conversation.id);
  });
  it('rolls notifications back with failed activity instead of delivering phantom alerts', async () => {
    const before = await prisma.notification.count({
      where: { userId: host.id },
    });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.userFollow.create({
          data: { followerId: stranger.id, followingId: host.id },
        });
        throw new Error('Abort verification transaction');
      }),
    ).rejects.toThrow('Abort verification transaction');
    expect(
      await prisma.notification.count({ where: { userId: host.id } }),
    ).toBe(before);
  });
  it('counts all unread rows across pages and marks all only for the current recipient', async () => {
    await prisma.notification.deleteMany({ where: { userId: stranger.id } });
    await prisma.notification.createMany({
      data: Array.from({ length: 45 }, () => ({
        userId: stranger.id,
        type: 'BADGE_UNLOCKED' as const,
      })),
    });
    const first = (await inbox(stranger, '?limit=10')).body;
    expect(first.items).toHaveLength(10);
    expect(first.unreadCount).toBe(45);
    expect(first.hasMore).toBe(true);
    const second = (await inbox(stranger, '?limit=10&offset=10')).body;
    expect(
      second.items
        .map((row: { id: string }) => row.id)
        .some((id: string) =>
          first.items.some((row: { id: string }) => row.id === id),
        ),
    ).toBe(false);
    const playerCount = (await inbox(player)).body.unreadCount;
    const result = await http()
      .patch('/api/v1/notifications/read-all')
      .set(auth(stranger))
      .expect(200);
    expect(result.body).toMatchObject({ updated: 45, unreadCount: 0 });
    expect((await inbox(stranger)).body.unreadCount).toBe(0);
    expect((await inbox(player)).body.unreadCount).toBe(playerCount);
  });
  it('records activity timestamps in UTC even when the database session uses Manila time', async () => {
    const before = Date.now();
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Manila'`;
      await tx.userFollow.create({
        data: { followerId: stranger.id, followingId: player.id },
      });
      return tx.notification.findFirstOrThrow({
        where: {
          userId: player.id,
          actorId: stranger.id,
          type: 'NEW_FOLLOWER',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
    expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(created.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
