import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { toPairKey } from '../src/social/relationship';

/** Real PostgreSQL queries; only these throwaway accounts are changed and removed. */
describe('GORA Points ranking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let viewer: string;
  let token: string;
  let baseline: number;
  const created: string[] = [];
  const suffix = randomBytes(4).toString('hex');
  const fixtures: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const get = (query = '') =>
    http()
      .get(`/api/v1/gora-points/ranking${query}`)
      .auth(token, { type: 'bearer' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const highest = await prisma.user.aggregate({ _max: { goraPoints: true } });
    baseline = (highest._max.goraPoints ?? 0) + 100;
    for (const [name, points] of [
      ['a', baseline + 90],
      ['b', baseline + 90],
      ['c', baseline + 80],
      ['viewer', -2],
      ['hidden', baseline + 120],
      ['blocker', baseline + 120],
      ['inactive', baseline + 150],
      ['admin', baseline + 200],
    ] as const) {
      const username = `rank_${name}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          username,
          email: `${username}@example.test`,
          passwordHash: 'unusable-test-fixture',
          firstName: 'Ranking',
          lastName: name,
          goraPoints: points,
          isActive: name !== 'inactive',
          role: name === 'admin' ? 'ADMIN' : 'USER',
        },
      });
      fixtures[name] = user.id;
      created.push(user.id);
    }
    viewer = fixtures.viewer;
    token = app.get(JwtService).sign({ sub: viewer });
    await prisma.friendship.createMany({
      data: [
        {
          requesterId: viewer,
          receiverId: fixtures.hidden,
          pairKey: toPairKey(viewer, fixtures.hidden),
          status: 'BLOCKED',
          blockedById: viewer,
        },
        {
          requesterId: fixtures.blocker,
          receiverId: viewer,
          pairKey: toPairKey(viewer, fixtures.blocker),
          status: 'BLOCKED',
          blockedById: fixtures.blocker,
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({ where: { id: { in: created } } });
    if (app) await app.close();
  });

  it('requires authentication and validates pagination and unknown input', async () => {
    await http().get('/api/v1/gora-points/ranking').expect(401);
    for (const query of [
      '?limit=0',
      '?limit=51',
      '?offset=-1',
      '?offset=nope',
      '?limit=1.5',
      '?userId=' + viewer,
      '?goraPoints=999',
    ]) {
      await get(query).expect(400);
    }
  });

  it('keeps ties, stable page order and the true own rank outside the first page', async () => {
    const first = await get('?limit=1').expect(200);
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(first.body.players[0]).toMatchObject({
      id: fixtures.a,
      rank: 1,
      goraPoints: baseline + 90,
    });
    expect(first.body.currentPlayer).toMatchObject({
      id: viewer,
      goraPoints: -2,
    });
    expect(first.body.currentPlayer.rank).toBeGreaterThan(3);
    expect(first.body).toMatchObject({ nextOffset: 1, hasMore: true });
    const next = await get('?limit=2&offset=1').expect(200);
    expect(
      next.body.players.map((p: { id: string; rank: number }) => [
        p.id,
        p.rank,
      ]),
    ).toEqual([
      [fixtures.b, 1],
      [fixtures.c, 3],
    ]);
    expect(next.body.currentPlayer.rank).toBe(first.body.currentPlayer.rank);
  });

  it('omits inactive accounts, administrators and blocks in either direction', async () => {
    const page = await get('?limit=50').expect(200);
    const ids = page.body.players.map((p: { id: string }) => p.id);
    for (const name of ['inactive', 'admin', 'hidden', 'blocker'])
      expect(ids).not.toContain(fixtures[name]);
    const higher = await prisma.user.count({
      where: {
        isActive: true,
        role: 'USER',
        goraPoints: { gt: -2 },
        id: { notIn: [fixtures.hidden, fixtures.blocker] },
      },
    });
    expect(page.body.currentPlayer.rank).toBe(higher + 1);
    for (const field of [
      'email',
      'passwordHash',
      'dateOfBirth',
      'phoneNumber',
      'role',
      'isActive',
    ]) {
      expect(JSON.stringify(page.body)).not.toContain(`"${field}"`);
    }
  });

  it('reads fresh scores and handles zero, negative and empty pages without changing points', async () => {
    await prisma.user.update({
      where: { id: fixtures.c },
      data: { goraPoints: baseline + 100 },
    });
    const fresh = await get('?limit=1').expect(200);
    expect(fresh.body.players[0]).toMatchObject({
      id: fixtures.c,
      rank: 1,
      goraPoints: baseline + 100,
    });
    const empty = await get('?offset=100000').expect(200);
    expect(empty.body).toMatchObject({
      players: [],
      hasMore: false,
      currentPlayer: { id: viewer, goraPoints: -2 },
    });
    await prisma.user.update({
      where: { id: viewer },
      data: { goraPoints: 0 },
    });
    const zero = await get().expect(200);
    expect(zero.body.currentPlayer.goraPoints).toBe(0);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: viewer } }))
        .goraPoints,
    ).toBe(0);
  });
});
