import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { toPairKey } from '../src/social/relationship';

interface Person {
  id: string;
  displayName: string;
  username: string;
}
interface Account {
  id: string;
  token: string;
  name: string;
}
interface Chat {
  id: string;
  partner: Person;
  lastMessage: string;
  lastMessageSenderId: string | null;
  unreadCount: number;
}
interface Message {
  id: string;
  senderId: string;
  sender: Person;
  body: string;
  reactions: { emoji: string; count: number; reacted: boolean }[];
}

describe('Direct chat sender identity and account isolation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let chatId: string;
  const users: Account[] = [];
  const http = () => request(app.getHttpServer());
  const headers = (index: number) => ({
    Authorization: `Bearer ${users[index].token}`,
  });
  const send = (index: number, body: Record<string, unknown>, id = chatId) =>
    http()
      .post(`/api/v1/chat/direct/${id}/messages`)
      .set(headers(index))
      .send(body);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (const name of ['Alice', 'Bob', 'Charlie']) {
      const username = `e2e_dm_${name.toLowerCase()}_${randomBytes(4).toString('hex')}`;
      const response = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: `${username}@example.test`,
          password: randomBytes(20).toString('hex'),
          firstName: name,
          lastName: 'Player',
        })
        .expect(201);
      const data = response.body as {
        user: { id: string };
        accessToken: string;
      };
      users.push({
        id: data.user.id,
        token: data.accessToken,
        name: `${name} Player`,
      });
    }
    await prisma.friendship.create({
      data: {
        requesterId: users[0].id,
        receiverId: users[1].id,
        pairKey: toPairKey(users[0].id, users[1].id),
        status: 'ACCEPTED',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      const ids = users.map((user) => user.id);
      await prisma.messageRequest.deleteMany({
        where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] },
      });
      await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
      await prisma.conversation.deleteMany({
        where: {
          type: 'DIRECT',
          participants: { some: { userId: { in: ids } } },
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
  });

  it('opens one chat per pair and returns the other participant for each viewer', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        http()
          .post(`/api/v1/chat/direct/${users[(i + 1) % 2].id}`)
          .set(headers(i % 2))
          .expect(201),
      ),
    );
    const chats = responses.map((response) => response.body as Chat);
    expect(new Set(chats.map((chat) => chat.id)).size).toBe(1);
    chatId = chats[0].id;
    for (let i = 0; i < chats.length; i++)
      expect(chats[i].partner.displayName).toBe(users[(i + 1) % 2].name);
    expect(
      await prisma.conversationParticipant.count({
        where: { conversationId: chatId },
      }),
    ).toBe(2);
    await http()
      .post(`/api/v1/chat/direct/${users[2].id}`)
      .set(headers(0))
      .expect(403);
    await http()
      .post(`/api/v1/chat/direct/${users[0].id}`)
      .set(headers(0))
      .expect(400);
  });

  it('uses the authenticated sender and preserves identity in both inboxes and message history', async () => {
    const sent = (await send(0, { body: ' Hello Bob! ' }).expect(201))
      .body as Message;
    expect(sent).toMatchObject({
      senderId: users[0].id,
      sender: { id: users[0].id, displayName: users[0].name },
      body: 'Hello Bob!',
    });
    const row = await prisma.message.findUniqueOrThrow({
      where: { id: sent.id },
    });
    expect(row.senderId).toBe(users[0].id);
    const aliceList = (
      await http().get('/api/v1/chat/direct').set(headers(0)).expect(200)
    ).body as Chat[];
    const bobList = (
      await http().get('/api/v1/chat/direct').set(headers(1)).expect(200)
    ).body as Chat[];
    expect(aliceList[0]).toMatchObject({
      partner: { id: users[1].id },
      lastMessageSenderId: users[0].id,
      unreadCount: 0,
    });
    expect(bobList[0]).toMatchObject({
      partner: { id: users[0].id, displayName: users[0].name },
      lastMessageSenderId: users[0].id,
      unreadCount: 1,
    });
    const page = (
      await http()
        .get(`/api/v1/chat/direct/${chatId}/messages`)
        .set(headers(1))
        .expect(200)
    ).body as { messages: Message[] };
    expect(page.messages[0].sender).toMatchObject({
      id: users[0].id,
      displayName: 'Alice Player',
    });
    const read = (
      await http()
        .get(`/api/v1/chat/direct/${chatId}`)
        .set(headers(1))
        .expect(200)
    ).body as Chat;
    expect(read.unreadCount).toBe(0);
    const reply = (await send(1, { body: 'Hi Alice!' }).expect(201))
      .body as Message;
    expect(reply.sender).toMatchObject({
      id: users[1].id,
      displayName: users[1].name,
    });
  });

  it('rejects forged sender/recipient fields, invalid messages and non-participants', async () => {
    await send(0, { body: 'Spoof', senderId: users[1].id }).expect(400);
    await send(0, { body: 'Spoof', recipientId: users[2].id }).expect(400);
    await send(0, { body: '  ' }).expect(400);
    await send(0, { body: 'x'.repeat(1001) }).expect(400);
    await send(2, { body: 'Intruder' }).expect(404);
    await http()
      .get(`/api/v1/chat/direct/${chatId}/messages`)
      .set(headers(2))
      .expect(404);
    await http().get('/api/v1/chat/direct').expect(401);
  });

  it('paginates without losing messages and validates cursors', async () => {
    for (const body of ['one', 'two', 'three'])
      await send(0, { body }).expect(201);
    const latest = (
      await http()
        .get(`/api/v1/chat/direct/${chatId}/messages?limit=2`)
        .set(headers(1))
        .expect(200)
    ).body as { messages: Message[]; nextCursor: string };
    expect(latest.messages.map((message) => message.body)).toEqual([
      'two',
      'three',
    ]);
    const older = (
      await http()
        .get(
          `/api/v1/chat/direct/${chatId}/messages?limit=2&before=${latest.nextCursor}`,
        )
        .set(headers(1))
        .expect(200)
    ).body as { messages: Message[] };
    expect(older.messages.map((message) => message.body)).toEqual([
      'Hi Alice!',
      'one',
    ]);
    await http()
      .get(`/api/v1/chat/direct/${chatId}/messages?before=${randomUUID()}`)
      .set(headers(1))
      .expect(400);
  });

  it('keeps request sender and recipient distinct and accepts the initial message exactly once', async () => {
    const response = await http()
      .post(`/api/v1/chat/requests/${users[0].id}`)
      .set(headers(2))
      .send({ body: 'Hi from Charlie' })
      .expect(201);
    const sent = response.body as { id: string; recipient: Person };
    expect(sent.recipient.id).toBe(users[0].id);
    const received = (
      await http().get('/api/v1/chat/requests').set(headers(0)).expect(200)
    ).body as { received: { id: string; sender: Person }[] };
    expect(received.received[0].sender).toMatchObject({
      id: users[2].id,
      displayName: users[2].name,
    });
    await http()
      .post(`/api/v1/chat/requests/${users[2].id}`)
      .set(headers(0))
      .send({ body: 'Duplicate reverse request' })
      .expect(409);
    await http()
      .post(`/api/v1/chat/requests/${sent.id}/accept`)
      .set(headers(2))
      .expect(404);
    const attempts = await Promise.all(
      [0, 1].map(() =>
        http().post(`/api/v1/chat/requests/${sent.id}/accept`).set(headers(0)),
      ),
    );
    expect(
      attempts.every((attempt) => [201, 409].includes(attempt.status)),
    ).toBe(true);
    const accepted = attempts.find((attempt) => attempt.status === 201)!
      .body as Chat;
    expect(accepted.partner.id).toBe(users[2].id);
    expect(
      await prisma.message.count({ where: { conversationId: accepted.id } }),
    ).toBe(1);
    const page = (
      await http()
        .get(`/api/v1/chat/direct/${accepted.id}/messages`)
        .set(headers(0))
        .expect(200)
    ).body as { messages: Message[] };
    expect(page.messages[0]).toMatchObject({
      senderId: users[2].id,
      sender: { displayName: users[2].name },
    });
    const otherView = (
      await http()
        .post(`/api/v1/chat/direct/${users[0].id}`)
        .set(headers(2))
        .expect(201)
    ).body as Chat;
    expect(otherView.partner.id).toBe(users[0].id);
    expect(otherView.id).toBe(accepted.id);
  });

  it('persists one reaction per account, groups counts, and changes or removes only the viewer reaction', async () => {
    const message = (await send(0, { body: 'React to this' }).expect(201))
      .body as Message;
    const path = `/api/v1/chat/direct/${chatId}/messages/${message.id}/reaction`;
    await Promise.all(
      Array.from({ length: 3 }, () =>
        http().put(path).set(headers(0)).send({ emoji: '❤️' }).expect(200),
      ),
    );
    const both = (
      await http().put(path).set(headers(1)).send({ emoji: '❤️' }).expect(200)
    ).body as Message;
    expect(both.reactions).toEqual([{ emoji: '❤️', count: 2, reacted: true }]);
    const changed = (
      await http().put(path).set(headers(1)).send({ emoji: '😂' }).expect(200)
    ).body as Message;
    expect(changed.reactions).toEqual([
      { emoji: '❤️', count: 1, reacted: false },
      { emoji: '😂', count: 1, reacted: true },
    ]);
    const history = (
      await http()
        .get(`/api/v1/chat/direct/${chatId}/messages`)
        .set(headers(0))
        .expect(200)
    ).body as { messages: Message[] };
    expect(
      history.messages.find((row) => row.id === message.id)?.reactions,
    ).toEqual([
      { emoji: '❤️', count: 1, reacted: true },
      { emoji: '😂', count: 1, reacted: false },
    ]);
    await http().delete(path).set(headers(1)).expect(200);
    const removed = (await http().delete(path).set(headers(1)).expect(200))
      .body as Message;
    expect(removed.reactions).toEqual([
      { emoji: '❤️', count: 1, reacted: false },
    ]);
    await http().put(path).set(headers(0)).send({ emoji: '🔥' }).expect(400);
    await http()
      .put(path)
      .set(headers(0))
      .send({ emoji: '👍', userId: users[1].id })
      .expect(400);
    await http().put(path).set(headers(2)).send({ emoji: '👍' }).expect(404);
    await http().delete(path).set(headers(2)).expect(404);
    await http().put(path).send({ emoji: '👍' }).expect(401);
    await http()
      .put(`/api/v1/chat/direct/${chatId}/messages/${randomUUID()}/reaction`)
      .set(headers(0))
      .send({ emoji: '👍' })
      .expect(404);
    await prisma.message.update({
      where: { id: message.id },
      data: { deletedAt: new Date() },
    });
    await http().put(path).set(headers(0)).send({ emoji: '👍' }).expect(404);
  });

  it('hides blocked conversations and prevents sending in either direction', async () => {
    const message = (await send(0, { body: 'Before blocking' }).expect(201))
      .body as Message;
    await prisma.friendship.update({
      where: { pairKey: toPairKey(users[0].id, users[1].id) },
      data: { status: 'BLOCKED', blockedById: users[0].id },
    });
    for (const viewer of [0, 1]) {
      await send(viewer, { body: 'Blocked' }).expect(404);
      await http()
        .put(`/api/v1/chat/direct/${chatId}/messages/${message.id}/reaction`)
        .set(headers(viewer))
        .send({ emoji: '👍' })
        .expect(404);
      await http()
        .get(`/api/v1/chat/direct/${chatId}/messages`)
        .set(headers(viewer))
        .expect(404);
      const list = (
        await http().get('/api/v1/chat/direct').set(headers(viewer)).expect(200)
      ).body as Chat[];
      expect(list.some((chat) => chat.id === chatId)).toBe(false);
    }
  });
});
