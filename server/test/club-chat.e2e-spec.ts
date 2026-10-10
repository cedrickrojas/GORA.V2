import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import type { ClubMemberStatus } from './../src/generated/prisma/client';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';
import { PrismaService } from './../src/prisma/prisma.service';
import { toPairKey } from './../src/social/relationship';

interface TestUser {
  id: string;
  username: string;
  token: string;
}

interface ChatBody {
  id: string;
  type: string;
  club: { id: string; name: string };
  memberCount: number;
  viewer: {
    role: string;
    permissions: {
      canRead: boolean;
      canSend: boolean;
      canModerate: boolean;
      canManage: boolean;
    };
  };
  lastMessage: { content: string } | null;
  unreadCount: number;
}

interface MessageBody {
  id: string;
  conversationId: string;
  content: string;
  sender: { id: string; displayName: string };
}

/** Real database, throwaway users and clubs; everything created here is removed afterwards. */
describe('Club group chats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const userIds: string[] = [];
  const clubIds: string[] = [];
  const directConversationIds: string[] = [];
  const users = {} as Record<
    | 'owner'
    | 'moderator'
    | 'member'
    | 'pending'
    | 'removed'
    | 'banned'
    | 'outsider'
    | 'otherOwner',
    TestUser
  >;
  let clubA: string;
  let clubB: string;

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_cc_${name}_${suffix}`.toLowerCase();
    const response = await http()
      .post('/api/v1/auth/register')
      .send({
        username,
        email: `${username}@example.test`,
        password: `Pw-${randomBytes(12).toString('hex')}`,
        firstName: 'E2E',
        lastName: name,
      })
      .expect(201);
    const body = response.body as { user: { id: string }; accessToken: string };
    userIds.push(body.user.id);

    return { id: body.user.id, username, token: body.accessToken };
  }

  async function createClub(owner: TestUser, name: string): Promise<string> {
    const club = await prisma.club.create({
      data: {
        ownerId: owner.id,
        name,
        slug: `e2e-${name.toLowerCase().replace(/\W+/g, '-')}-${suffix}`,
        maxMembers: 50,
      },
      select: { id: true },
    });
    clubIds.push(club.id);

    return club.id;
  }

  async function addMember(
    clubId: string,
    user: TestUser,
    status: ClubMemberStatus,
    role: 'MEMBER' | 'MODERATOR' | 'ADMIN' = 'MEMBER',
  ): Promise<void> {
    await prisma.clubMember.upsert({
      where: { clubId_userId: { clubId, userId: user.id } },
      create: { clubId, userId: user.id, status, role },
      update: { status, role },
    });
  }

  const chatUrl = (clubId: string) => `/api/v1/clubs/${clubId}/chat`;
  const messagesUrl = (clubId: string) =>
    `/api/v1/clubs/${clubId}/chat/messages`;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    for (const name of Object.keys({
      owner: 1,
      moderator: 1,
      member: 1,
      pending: 1,
      removed: 1,
      banned: 1,
      outsider: 1,
      otherOwner: 1,
    }) as (keyof typeof users)[]) {
      users[name] = await register(name);
    }

    clubA = await createClub(users.owner, 'Club A Volleyball');
    clubB = await createClub(users.otherOwner, 'Club B Basketball');
    await addMember(clubA, users.moderator, 'ACTIVE', 'MODERATOR');
    await addMember(clubA, users.member, 'ACTIVE');
    await addMember(clubA, users.pending, 'PENDING');
    await addMember(clubA, users.removed, 'ACTIVE');
    await addMember(clubA, users.banned, 'BANNED');
  });

  afterAll(async () => {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [
          { clubId: { in: clubIds } },
          { id: { in: directConversationIds } },
        ],
      },
      select: { id: true },
    });
    const conversationIds = conversations.map(({ id }) => id);

    await prisma.message.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.messageRequest.deleteMany({
      where: {
        OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }],
      },
    });
    await prisma.conversation.deleteMany({
      where: { id: { in: conversationIds } },
    });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('requires a signed-in user for every club chat route', async () => {
    await http().get('/api/v1/chat/clubs').expect(401);
    await http().get(chatUrl(clubA)).expect(401);
    await http().get(messagesUrl(clubA)).expect(401);
    await http().post(messagesUrl(clubA)).send({ content: 'hi' }).expect(401);
  });

  it('creating a club creates exactly one official club chat, and each club has its own', async () => {
    const chats = await prisma.conversation.findMany({
      where: { clubId: { in: [clubA, clubB] } },
      select: {
        id: true,
        type: true,
        clubId: true,
        gameId: true,
        directKey: true,
      },
    });

    expect(chats.filter((chat) => chat.clubId === clubA)).toHaveLength(1);
    expect(chats.filter((chat) => chat.clubId === clubB)).toHaveLength(1);
    expect(new Set(chats.map((chat) => chat.id)).size).toBe(2);

    for (const chat of chats) {
      expect(chat).toMatchObject({
        type: 'CLUB',
        gameId: null,
        directKey: null,
      });
    }

    // A second official chat for the same club, or a club chat without a club, is refused.
    await expect(
      prisma.conversation.create({ data: { type: 'CLUB', clubId: clubA } }),
    ).rejects.toThrow();
    await expect(
      prisma.conversation.create({ data: { type: 'CLUB' } }),
    ).rejects.toThrow();
    await expect(
      prisma.conversation.create({ data: { type: 'DIRECT', clubId: clubB } }),
    ).rejects.toThrow();

    const viaApiA = await http()
      .get(chatUrl(clubA))
      .set(auth(users.owner))
      .expect(200);
    const viaApiB = await http()
      .get(chatUrl(clubB))
      .set(auth(users.otherOwner))
      .expect(200);
    expect((viaApiA.body as ChatBody).id).toBe(
      chats.find((chat) => chat.clubId === clubA)?.id,
    );
    expect((viaApiA.body as ChatBody).id).not.toBe(
      (viaApiB.body as ChatBody).id,
    );
  });

  it('gives users no way to create a group chat', async () => {
    const outsider = auth(users.outsider);

    for (const path of [
      '/api/v1/conversations',
      '/api/v1/conversations/group',
      '/api/v1/chat/groups',
      chatUrl(clubA),
    ]) {
      await http()
        .post(path)
        .set(outsider)
        .send({ userIds: [users.member.id, users.owner.id] })
        .expect(404);
    }

    // The database backs this up: a direct chat holds two people and never turns into a group.
    const pairKey = toPairKey(users.outsider.id, users.member.id);
    const direct = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        directKey: `e2e-group-${pairKey}`,
        participants: {
          create: [{ userId: users.outsider.id }, { userId: users.member.id }],
        },
      },
      select: { id: true },
    });
    directConversationIds.push(direct.id);

    await expect(
      prisma.conversationParticipant.create({
        data: { conversationId: direct.id, userId: users.owner.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.conversation.update({
        where: { id: direct.id },
        data: { type: 'CLUB', directKey: null, clubId: clubB },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.conversationParticipant.count({
        where: { conversationId: direct.id },
      }),
    ).toBe(2);
  });

  it('lets ACTIVE members open the chat, send, and read, with role-based chat permissions', async () => {
    const opened = await http()
      .get(chatUrl(clubA))
      .set(auth(users.member))
      .expect(200);
    const chat = opened.body as ChatBody;

    expect(chat).toMatchObject({
      type: 'CLUB',
      club: { id: clubA, name: 'Club A Volleyball' },
      memberCount: 4,
      viewer: {
        role: 'MEMBER',
        permissions: {
          canRead: true,
          canSend: true,
          canModerate: false,
          canManage: false,
        },
      },
    });

    const sent = await http()
      .post(messagesUrl(clubA))
      .set(auth(users.member))
      .send({ content: '  Training starts at 6 PM today.  ' })
      .expect(201);
    const message = sent.body as MessageBody;
    expect(message).toMatchObject({
      conversationId: chat.id,
      content: 'Training starts at 6 PM today.',
      sender: { id: users.member.id, displayName: 'E2E member' },
    });

    await http()
      .post(messagesUrl(clubA))
      .set(auth(users.moderator))
      .send({ content: "I'll be there." })
      .expect(201);

    const ownerList = await http()
      .get('/api/v1/chat/clubs')
      .set(auth(users.owner))
      .expect(200);
    const ownerChat = (ownerList.body as ChatBody[]).find(
      (item) => item.club.id === clubA,
    );
    expect(ownerChat).toMatchObject({
      unreadCount: 2,
      lastMessage: { content: "I'll be there." },
      viewer: {
        role: 'OWNER',
        permissions: { canModerate: true, canManage: true },
      },
    });

    const history = await http()
      .get(messagesUrl(clubA))
      .set(auth(users.owner))
      .expect(200);
    expect(
      (history.body as { messages: MessageBody[] }).messages.map(
        (item) => item.content,
      ),
    ).toEqual(['Training starts at 6 PM today.', "I'll be there."]);

    const afterRead = await http()
      .get(chatUrl(clubA))
      .set(auth(users.owner))
      .expect(200);
    expect((afterRead.body as ChatBody).unreadCount).toBe(0);

    const moderator = await http()
      .get(chatUrl(clubA))
      .set(auth(users.moderator))
      .expect(200);
    expect((moderator.body as ChatBody).viewer.permissions).toEqual({
      canRead: true,
      canSend: true,
      canModerate: true,
      canManage: false,
    });

    const firstPage = await http()
      .get(`${messagesUrl(clubA)}?limit=1`)
      .set(auth(users.member))
      .expect(200);
    const page = firstPage.body as {
      messages: MessageBody[];
      nextCursor: string;
    };
    expect(page.messages.map((item) => item.content)).toEqual([
      "I'll be there.",
    ]);
    const olderPage = await http()
      .get(`${messagesUrl(clubA)}?limit=1&before=${page.nextCursor}`)
      .set(auth(users.member))
      .expect(200);
    expect(
      (olderPage.body as { messages: MessageBody[] }).messages[0].content,
    ).toBe('Training starts at 6 PM today.');
  });

  it('refuses empty, oversized, and tampered messages', async () => {
    const member = auth(users.member);

    await http()
      .post(messagesUrl(clubA))
      .set(member)
      .send({ content: '   ' })
      .expect(400);
    await http()
      .post(messagesUrl(clubA))
      .set(member)
      .send({ content: 'x'.repeat(2001) })
      .expect(400);

    for (const extra of [
      { senderId: users.owner.id },
      { conversationId: randomUUID() },
      { clubId: clubB },
    ]) {
      await http()
        .post(messagesUrl(clubA))
        .set(member)
        .send({ content: 'sneaky', ...extra })
        .expect(400);
    }
  });

  it('denies PENDING, REMOVED, BANNED members and non-members', async () => {
    await http()
      .post(messagesUrl(clubA))
      .set(auth(users.removed))
      .send({ content: 'Before I was removed.' })
      .expect(201);
    await addMember(clubA, users.removed, 'REMOVED');

    for (const user of [
      users.pending,
      users.removed,
      users.banned,
      users.outsider,
    ]) {
      const denied = await http().get(chatUrl(clubA)).set(auth(user));
      expect(denied.status).toBe(403);
      await http().get(messagesUrl(clubA)).set(auth(user)).expect(403);
      await http()
        .post(messagesUrl(clubA))
        .set(auth(user))
        .send({ content: 'Let me in.' })
        .expect(403);

      const list = await http()
        .get('/api/v1/chat/clubs')
        .set(auth(user))
        .expect(200);
      expect(
        (list.body as ChatBody[]).some((item) => item.club.id === clubA),
      ).toBe(false);
    }

    const pending = await http().get(chatUrl(clubA)).set(auth(users.pending));
    expect((pending.body as { message: string }).message).toContain(
      "hasn't been approved",
    );

    // History stays: the removed member's earlier message is still in the chat.
    const history = await http()
      .get(messagesUrl(clubA))
      .set(auth(users.member))
      .expect(200);
    expect(
      (history.body as { messages: MessageBody[] }).messages.some(
        (item) => item.content === 'Before I was removed.',
      ),
    ).toBe(true);

    // The database refuses the same senders even if the service were bypassed.
    const chat = await prisma.conversation.findUniqueOrThrow({
      where: { clubId: clubA },
      select: { id: true },
    });
    for (const user of [users.pending, users.removed, users.outsider]) {
      await expect(
        prisma.message.create({
          data: { conversationId: chat.id, senderId: user.id, content: 'x' },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.conversationParticipant.create({
          data: { conversationId: chat.id, userId: user.id },
        }),
      ).rejects.toThrow();
    }
  });

  it("keeps Club A members out of Club B's chat", async () => {
    const before = await prisma.message.count({
      where: { conversation: { clubId: clubB } },
    });

    await http().get(chatUrl(clubB)).set(auth(users.member)).expect(403);
    await http().get(messagesUrl(clubB)).set(auth(users.member)).expect(403);
    await http()
      .post(messagesUrl(clubB))
      .set(auth(users.member))
      .send({ content: 'Hello Club B' })
      .expect(403);

    expect(
      await prisma.message.count({
        where: { conversation: { clubId: clubB } },
      }),
    ).toBe(before);

    const list = await http()
      .get('/api/v1/chat/clubs')
      .set(auth(users.member))
      .expect(200);
    expect((list.body as ChatBody[]).map((item) => item.club.id)).toEqual([
      clubA,
    ]);

    await http().get(chatUrl(randomUUID())).set(auth(users.member)).expect(404);
    await http()
      .get('/api/v1/clubs/not-a-club/chat')
      .set(auth(users.member))
      .expect(404);
  });

  it('closes the chat of a deactivated club without deleting its messages', async () => {
    const chat = await prisma.conversation.findUniqueOrThrow({
      where: { clubId: clubA },
      select: { id: true },
    });
    const kept = await prisma.message.count({
      where: { conversationId: chat.id },
    });
    expect(kept).toBeGreaterThan(0);

    await prisma.club.update({
      where: { id: clubA },
      data: { isActive: false },
    });

    try {
      const closed = await http().get(chatUrl(clubA)).set(auth(users.owner));
      expect(closed.status).toBe(403);
      expect((closed.body as { message: string }).message).toContain(
        'no longer active',
      );
      await http()
        .post(messagesUrl(clubA))
        .set(auth(users.owner))
        .send({ content: 'Anyone here?' })
        .expect(403);
      await expect(
        prisma.message.create({
          data: {
            conversationId: chat.id,
            senderId: users.owner.id,
            content: 'x',
          },
        }),
      ).rejects.toThrow();

      expect(
        await prisma.message.count({ where: { conversationId: chat.id } }),
      ).toBe(kept);
    } finally {
      await prisma.club.update({
        where: { id: clubA },
        data: { isActive: true },
      });
    }
  });

  it('leaves direct messages and message requests working', async () => {
    const [a, b] = [users.outsider, users.otherOwner];
    const pairKey = toPairKey(a.id, b.id);

    const request = await prisma.messageRequest.create({
      data: {
        senderId: a.id,
        receiverId: b.id,
        pairKey,
        initialMessage: 'Want to play Saturday?',
      },
      select: { id: true },
    });
    await expect(
      prisma.messageRequest.create({
        data: {
          senderId: b.id,
          receiverId: a.id,
          pairKey,
          initialMessage: 'Duplicate',
        },
      }),
    ).rejects.toThrow();

    const direct = await prisma.conversation.create({
      data: {
        type: 'DIRECT',
        directKey: pairKey,
        participants: { create: [{ userId: a.id }, { userId: b.id }] },
      },
      select: { id: true },
    });
    directConversationIds.push(direct.id);
    await prisma.messageRequest.update({
      where: { id: request.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        conversationId: direct.id,
      },
    });

    await prisma.message.create({
      data: { conversationId: direct.id, senderId: a.id, content: 'Hi!' },
    });
    await prisma.message.create({
      data: { conversationId: direct.id, senderId: b.id, content: 'Hello!' },
    });
    await expect(
      prisma.message.create({
        data: {
          conversationId: direct.id,
          senderId: users.member.id,
          content: 'Not my chat',
        },
      }),
    ).rejects.toThrow();

    expect(
      await prisma.message.count({ where: { conversationId: direct.id } }),
    ).toBe(2);
  });
});
