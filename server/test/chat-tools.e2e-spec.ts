import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { toPairKey } from '../src/social/relationship';

interface User {
  id: string;
  token: string;
}
interface Message {
  id: string;
  body: string;
  senderId: string;
  unsent: boolean;
  forwarded: boolean;
  pinned: boolean;
  attachment: { kind: string; url: string } | null;
}
interface Call {
  id: string;
  status: string;
  offer: string;
  answer: string | null;
  callerCandidates: unknown[];
}

describe('Direct chat media, message tools, and calls (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const users: User[] = [];
  const chats: string[] = [];
  let photoMessage: Message;
  let audioMessage: Message;
  const http = () => request(app.getHttpServer());
  const auth = (index = 0) => ({
    Authorization: `Bearer ${users[index].token}`,
  });
  const root = (id = chats[0]) => `/api/v1/chat/direct/${id}`;
  const message = (id: string) => `${root()}/messages/${id}`;
  const png = Buffer.concat([
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
      'base64',
    ),
    Buffer.alloc(120000),
  ]);
  const photo = `data:image/png;base64,${png.toString('base64')}`;
  const voice = `data:audio/webm;codecs=opus;base64,${Buffer.concat([Buffer.from('1a45dfa3', 'hex'), Buffer.alloc(120000)]).toString('base64')}`;
  const offer = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=QA\r\n';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const username = `e2e_tools_${randomBytes(6).toString('hex')}`;
      const response = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: `${username}@example.test`,
          password: randomBytes(20).toString('hex'),
          firstName: 'Chat',
          lastName: 'Tools QA',
        })
        .expect(201);
      const data = response.body as {
        user: { id: string };
        accessToken: string;
      };
      users.push({ id: data.user.id, token: data.accessToken });
    }
    for (const target of [1, 2]) {
      await prisma.friendship.create({
        data: {
          requesterId: users[0].id,
          receiverId: users[target].id,
          pairKey: toPairKey(users[0].id, users[target].id),
          status: 'ACCEPTED',
        },
      });
      const response = await http()
        .post(`/api/v1/chat/direct/${users[target].id}`)
        .set(auth())
        .expect(201);
      chats.push((response.body as { id: string }).id);
    }
  }, 120000);
  afterAll(async () => {
    if (prisma) {
      const ids = users.map((u) => u.id);
      await prisma.report.deleteMany({ where: { reporterId: { in: ids } } });
      await prisma.directCall.deleteMany({ where: { callerId: { in: ids } } });
      await prisma.message.deleteMany({ where: { senderId: { in: ids } } });
      await prisma.conversation.deleteMany({ where: { id: { in: chats } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  }, 60000);

  it('persists photo and voice attachments and refuses unsupported or oversized payloads', async () => {
    await http()
      .post(`${root()}/attachments`)
      .send({ data: photo })
      .expect(401);
    await http()
      .post(`${root()}/attachments`)
      .set(auth(2))
      .send({ data: photo })
      .expect(404);
    for (const data of [
      'data:image/svg+xml;base64,PHN2Zy8+',
      'data:audio/webm;base64,aGVsbG8=',
      'https://example.com/audio.mp3',
      `data:audio/webm;base64,${Buffer.alloc(1024 * 1024 + 1).toString('base64')}`,
    ])
      await http()
        .post(`${root()}/attachments`)
        .set(auth())
        .send({ data })
        .expect(400);
    photoMessage = (
      await http()
        .post(`${root()}/attachments`)
        .set(auth())
        .send({ data: photo })
        .expect(201)
    ).body as Message;
    audioMessage = (
      await http()
        .post(`${root()}/attachments`)
        .set(auth(1))
        .send({ data: voice })
        .expect(201)
    ).body as Message;
    expect(photoMessage.attachment?.kind).toBe('image');
    expect(audioMessage.attachment?.kind).toBe('audio');
    expect(photoMessage).not.toHaveProperty('attachmentData');
    const result = await http()
      .get(photoMessage.attachment!.url)
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store');
    expect(result.body as Buffer).toEqual(png);
    await http()
      .get(audioMessage.attachment!.url)
      .expect(200)
      .expect('Content-Type', /audio\/webm/);
    await http()
      .get(photoMessage.attachment!.url.replace(users[0].id, users[2].id))
      .expect(401);
  }, 90000);

  it('shares pins and forwards an independent message with the current sender identity', async () => {
    await http()
      .put(`${message(photoMessage.id)}/pin`)
      .set(auth(2))
      .send({ pinned: true })
      .expect(404);
    await http()
      .put(`${message(photoMessage.id)}/pin`)
      .set(auth(1))
      .send({ pinned: true })
      .expect(200);
    const pins = (await http().get(`${root()}/pins`).set(auth()).expect(200))
      .body as Message[];
    expect(pins[0].id).toBe(photoMessage.id);
    await http()
      .post(`${message(photoMessage.id)}/forward`)
      .set(auth(1))
      .send({ conversationId: chats[1] })
      .expect(404);
    const forwarded = (
      await http()
        .post(`${message(photoMessage.id)}/forward`)
        .set(auth())
        .send({ conversationId: chats[1] })
        .expect(201)
    ).body as Message;
    expect(forwarded.senderId).toBe(users[0].id);
    expect(forwarded.forwarded).toBe(true);
    expect(forwarded.pinned).toBe(false);
    expect(forwarded.id).not.toBe(photoMessage.id);
    await http().get(forwarded.attachment!.url).expect(200);
    await http()
      .put(`${message(photoMessage.id)}/pin`)
      .set(auth())
      .send({ pinned: false })
      .expect(200);
    expect(
      (await http().get(`${root()}/pins`).set(auth(1)).expect(200)).body,
    ).toEqual([]);
  });

  it('records a private moderation report without accepting spoofed reporters or allowing self-reports', async () => {
    const path = `${message(audioMessage.id)}/report`;
    await http().post(path).set(auth(1)).send({ reason: 'SPAM' }).expect(400);
    await http().post(path).set(auth(2)).send({ reason: 'SPAM' }).expect(404);
    await http().post(path).set(auth()).send({ reason: 'INVALID' }).expect(400);
    await http()
      .post(path)
      .set(auth())
      .send({ reason: 'SPAM', reporterId: users[1].id })
      .expect(400);
    const report = (
      await http()
        .post(path)
        .set(auth())
        .send({ reason: 'SPAM', description: 'QA report' })
        .expect(201)
    ).body as { id: string; reported: boolean };
    expect(report.reported).toBe(true);
    expect(
      await prisma.report.findUnique({
        where: { id: report.id },
        select: {
          reporterId: true,
          reportedUserId: true,
          status: true,
          reason: true,
        },
      }),
    ).toEqual({
      reporterId: users[0].id,
      reportedUserId: users[1].id,
      status: 'PENDING',
      reason: 'SPAM',
    });
    const duplicate = (
      await http().post(path).set(auth()).send({ reason: 'SPAM' }).expect(201)
    ).body as { id: string };
    expect(duplicate.id).toBe(report.id);
  });

  it('allows only the sender to unsend, clears media and pins, and retains a tombstone after refresh and pagination', async () => {
    await http().delete(message(photoMessage.id)).set(auth(1)).expect(403);
    await http().delete(message(photoMessage.id)).set(auth(2)).expect(404);
    await http()
      .put(`${message(photoMessage.id)}/pin`)
      .set(auth())
      .send({ pinned: true })
      .expect(200);
    const removed = (
      await http().delete(message(photoMessage.id)).set(auth()).expect(200)
    ).body as Message;
    expect(removed.unsent).toBe(true);
    expect(removed.body).toBe('Message unsent');
    expect(removed.attachment).toBeNull();
    expect(removed.pinned).toBe(false);
    await http().delete(message(photoMessage.id)).set(auth()).expect(200);
    await http().get(photoMessage.attachment!.url).expect(404);
    await http()
      .post(`${message(photoMessage.id)}/forward`)
      .set(auth())
      .send({ conversationId: chats[1] })
      .expect(404);
    const loaded = (
      await http().get(`${root()}/messages`).set(auth(1)).expect(200)
    ).body as { messages: Message[] };
    expect(loaded.messages.find((m) => m.id === removed.id)?.unsent).toBe(true);
    await http()
      .get(`${root()}/messages?before=${removed.id}`)
      .set(auth())
      .expect(200);
    const copy = await prisma.message.findFirstOrThrow({
      where: { conversationId: chats[1], isForwarded: true },
      select: { attachmentData: true },
    });
    expect(copy.attachmentData).not.toBeNull();
    expect(
      await prisma.message.findUnique({
        where: { id: removed.id },
        select: { attachmentData: true, pinnedAt: true },
      }),
    ).toEqual({ attachmentData: null, pinnedAt: null });
  });

  it('restricts call signaling to the participants, validates roles, rejects busy calls, and clears signaling on hang-up', async () => {
    await http()
      .post(`${root()}/calls`)
      .send({ mode: 'VIDEO', offer })
      .expect(401);
    await http()
      .post(`${root()}/calls`)
      .set(auth(2))
      .send({ mode: 'VIDEO', offer })
      .expect(404);
    await http()
      .post(`${root()}/calls`)
      .set(auth())
      .send({ mode: 'VIDEO', offer: 'not SDP' })
      .expect(400);
    const call = (
      await http()
        .post(`${root()}/calls`)
        .set(auth())
        .send({ mode: 'VIDEO', offer })
        .expect(201)
    ).body as Call;
    const path = `/api/v1/chat/calls/${call.id}`;
    await http().get(path).set(auth(2)).expect(404);
    await http()
      .post(`${root(chats[1])}/calls`)
      .set(auth())
      .send({ mode: 'AUDIO', offer })
      .expect(409);
    const incoming = (
      await http().get('/api/v1/chat/calls/incoming').set(auth(1)).expect(200)
    ).body as { call: Call };
    expect(incoming.call.id).toBe(call.id);
    await http()
      .put(`${path}/answer`)
      .set(auth())
      .send({ answer: offer })
      .expect(403);
    await http()
      .post(`${path}/candidates`)
      .set(auth())
      .send({
        candidate: 'candidate:1 1 UDP 1 127.0.0.1 4000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      })
      .expect(201);
    const answered = (
      await http()
        .put(`${path}/answer`)
        .set(auth(1))
        .send({ answer: offer })
        .expect(200)
    ).body as Call;
    expect(answered.status).toBe('ACTIVE');
    const received = (await http().get(path).set(auth()).expect(200))
      .body as Call;
    expect(received.answer).toBe(offer);
    expect(received.callerCandidates).toHaveLength(1);
    await http().delete(path).set(auth(2)).expect(404);
    await http().delete(path).set(auth(1)).expect(200);
    const ended = (await http().get(path).set(auth()).expect(200)).body as Call;
    expect(ended.status).toBe('ENDED');
    expect(ended.offer).toBe('');
    expect(ended.answer).toBeNull();
    expect(ended.callerCandidates).toEqual([]);
    await http()
      .post(`${path}/candidates`)
      .set(auth())
      .send({ candidate: 'candidate:late' })
      .expect(409);
  }, 90000);

  it('handles simultaneous calls, decline, missed calls, and stale active sessions', async () => {
    const result = await Promise.all(
      [0, 1].map((i) =>
        http()
          .post(`${root()}/calls`)
          .set(auth(i))
          .send({ mode: 'AUDIO', offer }),
      ),
    );
    expect(result.map((r) => r.status).sort()).toEqual([201, 409]);
    const created = result.find((r) => r.status === 201)!.body as Call;
    await http()
      .delete(`/api/v1/chat/calls/${created.id}`)
      .set(auth(result[0].status === 201 ? 1 : 0))
      .expect(200);
    const declined = (
      await http()
        .get(`/api/v1/chat/calls/${created.id}`)
        .set(auth())
        .expect(200)
    ).body as Call;
    expect(declined.status).toBe('DECLINED');
    const missed = (
      await http()
        .post(`${root()}/calls`)
        .set(auth())
        .send({ mode: 'AUDIO', offer })
        .expect(201)
    ).body as Call;
    await prisma.directCall.update({
      where: { id: missed.id },
      data: { createdAt: new Date(Date.now() - 60000) },
    });
    const expired = (
      await http()
        .get(`/api/v1/chat/calls/${missed.id}`)
        .set(auth())
        .expect(200)
    ).body as Call;
    expect(expired.status).toBe('MISSED');
    const stale = (
      await http()
        .post(`${root()}/calls`)
        .set(auth())
        .send({ mode: 'AUDIO', offer })
        .expect(201)
    ).body as Call;
    await http()
      .put(`/api/v1/chat/calls/${stale.id}/answer`)
      .set(auth(1))
      .send({ answer: offer })
      .expect(200);
    await prisma.directCall.update({
      where: { id: stale.id },
      data: { callerSeenAt: new Date(Date.now() - 90000) },
    });
    expect(
      (
        (
          await http()
            .get(`/api/v1/chat/calls/${stale.id}`)
            .set(auth(1))
            .expect(200)
        ).body as Call
      ).status,
    ).toBe('ENDED');
  }, 90000);

  it('rechecks blocks on stored attachments, pins, and call endpoints', async () => {
    const call = (
      await http()
        .post(`${root()}/calls`)
        .set(auth())
        .send({ mode: 'AUDIO', offer })
        .expect(201)
    ).body as Call;
    await prisma.friendship.update({
      where: { pairKey: toPairKey(users[0].id, users[1].id) },
      data: { status: 'BLOCKED', blockedById: users[0].id },
    });
    await http().get(audioMessage.attachment!.url).expect(404);
    await http().get(`${root()}/pins`).set(auth(1)).expect(404);
    await http().get(`/api/v1/chat/calls/${call.id}`).set(auth(1)).expect(404);
    expect(
      (await http().get('/api/v1/chat/calls/incoming').set(auth(1)).expect(200))
        .body,
    ).toEqual({ call: null });
  });
});
