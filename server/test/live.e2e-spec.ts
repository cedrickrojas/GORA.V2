import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { toPairKey } from '../src/social/relationship';
import { LiveService } from '../src/live/live.service';
import { ConfigService } from '@nestjs/config';
import { RelationshipService } from '../src/social/relationship.service';

interface Live {
  id: string;
  host: { id: string; displayName: string };
  status: string;
  viewerCount: number;
}
interface Peer {
  id: string;
  offer: string | null;
  answer: string | null;
}
describe('Live broadcasts and private signaling (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const users: { id: string; token: string }[] = [];
  const http = () => request(app.getHttpServer());
  const headers = (index: number) => ({
    Authorization: `Bearer ${users[index].token}`,
  });
  const start = async () =>
    (
      await http()
        .post('/api/v1/live')
        .set(headers(0))
        .send({ title: ' Court action ' })
        .expect(201)
    ).body as Live;
  const join = async (id: string, index = 1) =>
    (
      await http()
        .post(`/api/v1/live/${id}/viewers`)
        .set(headers(index))
        .expect(201)
    ).body as Peer;
  const sdp = 'v=0\r\ns=test\r\n';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (let i = 0; i < 13; i++) {
      const username = `e2e_live_${randomBytes(5).toString('hex')}`;
      const response = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: `${username}@example.test`,
          password: randomBytes(20).toString('hex'),
          firstName: i === 0 ? 'Live' : 'Viewer',
          lastName: 'Player',
        })
        .expect(201);
      const body = response.body as {
        user: { id: string };
        accessToken: string;
      };
      users.push({ id: body.user.id, token: body.accessToken });
    }
  });
  beforeEach(async () => {
    await prisma.liveStream.deleteMany({
      where: { hostId: { in: users.map((user) => user.id) } },
    });
    await prisma.friendship.deleteMany({
      where: { requesterId: { in: users.map((user) => user.id) } },
    });
  });
  afterAll(async () => {
    if (prisma) {
      const ids = users.map((user) => user.id);
      await prisma.liveStream.deleteMany({ where: { hostId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
  });

  it('requires authentication and validates title and signaling input', async () => {
    await http().get('/api/v1/live').expect(401);
    await http().get('/api/v1/live/config').expect(401);
    for (const title of ['', '   ', 'x'.repeat(121)])
      await http()
        .post('/api/v1/live')
        .set(headers(0))
        .send({ title })
        .expect(400);
    await http()
      .post('/api/v1/live')
      .set(headers(0))
      .send({ title: 'Test', hostId: users[1].id })
      .expect(400);
    const live = await start();
    const peer = await join(live.id);
    for (const value of ['invalid SDP', 'v=0\n' + 'x'.repeat(65536)])
      await http()
        .put(`/api/v1/live/${live.id}/viewers/${peer.id}/offer`)
        .set(headers(0))
        .send({ sdp: value })
        .expect(400);
  });

  it('starts exactly one stream for concurrent requests and publishes safe host identity', async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        http()
          .post('/api/v1/live')
          .set(headers(0))
          .send({ title: 'Court action' }),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409, 409, 409,
    ]);
    const list = (await http().get('/api/v1/live').set(headers(1)).expect(200))
      .body as Live[];
    const live = list.find((item) => item.host.id === users[0].id)!;
    expect(live.host).toMatchObject({
      id: users[0].id,
      displayName: 'Live Player',
    });
    expect(live.host).not.toHaveProperty('email');
    expect(live.host).not.toHaveProperty('passwordHash');
    const mine = (
      await http().get('/api/v1/live/mine').set(headers(0)).expect(200)
    ).body as { live: Live };
    expect(mine.live.id).toBe(live.id);
    expect(
      (await http().get('/api/v1/live/mine').set(headers(1)).expect(200)).body,
    ).toEqual({ live: null });
    await http()
      .post(`/api/v1/live/${live.id}/viewers`)
      .set(headers(0))
      .expect(409);
  });

  it('exchanges offers and answers only between the host and the specific viewer', async () => {
    const live = await start();
    const peer = await join(live.id);
    const path = `/api/v1/live/${live.id}/viewers/${peer.id}`;
    await http()
      .get(`/api/v1/live/${live.id}/peers`)
      .set(headers(1))
      .expect(403);
    await http().get(path).set(headers(2)).expect(403);
    await http().put(`${path}/offer`).set(headers(1)).send({ sdp }).expect(403);
    await http()
      .put(`${path}/answer`)
      .set(headers(1))
      .send({ sdp })
      .expect(409);
    await http().put(`${path}/offer`).set(headers(0)).send({ sdp }).expect(200);
    const polled = (await http().get(path).set(headers(1)).expect(200))
      .body as Peer;
    expect(polled.offer).toBe(sdp);
    await http()
      .put(`${path}/answer`)
      .set(headers(2))
      .send({ sdp })
      .expect(403);
    await http()
      .put(`${path}/answer`)
      .set(headers(1))
      .send({ sdp })
      .expect(200);
    const rows = (
      await http()
        .get(`/api/v1/live/${live.id}/peers`)
        .set(headers(0))
        .expect(200)
    ).body as Peer[];
    expect(rows).toEqual([
      expect.objectContaining({ id: peer.id, answer: sdp }),
    ]);
    await http()
      .put(`${path}/offer`)
      .set(headers(0))
      .send({ sdp: `${sdp}s=changed\n` })
      .expect(409);
  });

  it('reconnects with a fresh session, supports idempotent leave and clears SDP', async () => {
    const live = await start();
    const first = await join(live.id);
    const next = await join(live.id);
    expect(next.id).not.toBe(first.id);
    await http()
      .get(`/api/v1/live/${live.id}/viewers/${first.id}`)
      .set(headers(1))
      .expect(410);
    const path = `/api/v1/live/${live.id}/viewers/${next.id}`;
    await http().delete(path).set(headers(2)).expect(403);
    await http().delete(path).set(headers(1)).expect(200);
    await http().delete(path).set(headers(1)).expect(200);
    const left = await prisma.liveViewer.findUnique({ where: { id: next.id } });
    expect(left).toMatchObject({ offer: null, answer: null });
    expect(left?.leftAt).toBeInstanceOf(Date);
    const info = (
      await http().get(`/api/v1/live/${live.id}`).set(headers(0)).expect(200)
    ).body as Live;
    expect(info.viewerCount).toBe(0);
  });

  it('ends the broadcast for every viewer and prevents new joins and signals', async () => {
    const live = await start();
    const peer = await join(live.id);
    await http().delete(`/api/v1/live/${live.id}`).set(headers(1)).expect(403);
    await http().delete(`/api/v1/live/${live.id}`).set(headers(0)).expect(200);
    await http().delete(`/api/v1/live/${live.id}`).set(headers(0)).expect(200);
    await http()
      .get(`/api/v1/live/${live.id}/viewers/${peer.id}`)
      .set(headers(1))
      .expect(410);
    await http()
      .post(`/api/v1/live/${live.id}/viewers`)
      .set(headers(1))
      .expect(410);
    await http()
      .put(`/api/v1/live/${live.id}/viewers/${peer.id}/offer`)
      .set(headers(0))
      .send({ sdp })
      .expect(410);
    expect((await start()).id).not.toBe(live.id);
  });

  it('removes disconnected viewers and closes abandoned broadcasts automatically', async () => {
    const live = await start();
    const peer = await join(live.id);
    await prisma.liveViewer.update({
      where: { id: peer.id },
      data: { lastSeenAt: new Date(Date.now() - 31_000), offer: sdp },
    });
    await http()
      .get(`/api/v1/live/${live.id}/viewers/${peer.id}`)
      .set(headers(1))
      .expect(410);
    const next = await join(live.id);
    await prisma.liveStream.update({
      where: { id: live.id },
      data: { updatedAt: new Date(Date.now() - 46_000) },
    });
    const info = (
      await http().get(`/api/v1/live/${live.id}`).set(headers(1)).expect(200)
    ).body as Live;
    expect(info.status).toBe('ENDED');
    const expired = await prisma.liveViewer.findUnique({
      where: { id: next.id },
    });
    expect(expired).toMatchObject({ offer: null, answer: null });
    expect(expired?.leftAt).toBeInstanceOf(Date);
    await http()
      .get(`/api/v1/live/${live.id}/peers`)
      .set(headers(0))
      .expect(410);
  });

  it('enforces viewer capacity even during simultaneous joins', async () => {
    const live = await start();
    const responses = await Promise.all(
      users.slice(1).map((_, i) =>
        http()
          .post(`/api/v1/live/${live.id}/viewers`)
          .set(headers(i + 1)),
      ),
    );
    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(10);
    expect(
      responses.filter((response) => response.status === 409),
    ).toHaveLength(2);
    expect(
      await prisma.liveViewer.count({
        where: { liveStreamId: live.id, leftAt: null },
      }),
    ).toBe(10);
  });

  it.each([0, 1])(
    'honors blocks in either direction and disconnects existing viewers (blocker %s)',
    async (blocker) => {
      const live = await start();
      const peer = await join(live.id);
      await prisma.friendship.create({
        data: {
          requesterId: users[0].id,
          receiverId: users[1].id,
          pairKey: toPairKey(users[0].id, users[1].id),
          status: 'BLOCKED',
          blockedById: users[blocker].id,
        },
      });
      const list = (
        await http().get('/api/v1/live').set(headers(1)).expect(200)
      ).body as Live[];
      expect(list.some((item) => item.id === live.id)).toBe(false);
      await http().get(`/api/v1/live/${live.id}`).set(headers(1)).expect(403);
      await http()
        .get(`/api/v1/live/${live.id}/viewers/${peer.id}`)
        .set(headers(1))
        .expect(403);
      const peers = (
        await http()
          .get(`/api/v1/live/${live.id}/peers`)
          .set(headers(0))
          .expect(200)
      ).body as Peer[];
      expect(peers).toHaveLength(0);
    },
  );

  it('issues expiring TURN credentials without revealing the shared secret', () => {
    const service = new LiveService(
      prisma,
      app.get(RelationshipService),
      new ConfigService({
        LIVE_STUN_URLS: '',
        LIVE_TURN_URLS: 'turn:relay.example.test:3478',
        LIVE_TURN_SECRET: 'test-only-turn-secret',
      }),
    );
    const config = service.config(users[1].id);
    expect(config.iceServers[0]).toMatchObject({
      urls: ['turn:relay.example.test:3478'],
    });
    expect(config.iceServers[0].username).toContain(users[1].id);
    expect(typeof config.iceServers[0].credential).toBe('string');
    expect(JSON.stringify(config)).not.toContain('test-only-turn-secret');
  });
});
