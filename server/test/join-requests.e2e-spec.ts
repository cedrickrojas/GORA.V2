import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';
import { readGameTimezone } from './../src/config/env.validation';
import { addDays, localMoment } from './../src/games/game-schedule';
import { PrismaService } from './../src/prisma/prisma.service';
import { toPairKey } from './../src/social/relationship';

interface TestUser {
  id: string;
  username: string;
  token: string;
}

interface GameBody {
  id: string;
  status: string;
  currentPlayers: number;
  requiredPlayers: number;
  pendingRequestCount: number | null;
}

interface JoinRequestBody {
  id: string;
  gameId: string;
  userId: string;
  message: string | null;
  status: string;
  createdAt: string;
  respondedAt: string | null;
}

interface HostJoinRequestBody extends JoinRequestBody {
  user: Record<string, unknown>;
}

interface ErrorBody {
  success: boolean;
  message: string | string[];
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';
const SENSITIVE_KEYS = [
  'email',
  'passwordHash',
  'password',
  'dateOfBirth',
  'role',
  'isActive',
];

/**
 * Real database. Throwaway users and their games are created here and removed
 * afterwards (join requests first, since they keep the user row).
 */
describe('Join requests (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const createdUsers: string[] = [];
  const createdClubs: string[] = [];
  let basketballId = '';

  const now = localMoment(readGameTimezone(process.env.GAME_TIMEZONE));

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });
  const requestsOf = (gameId: string) =>
    `/api/v1/games/${gameId}/join-requests`;

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_jr_${name}_${suffix}`;
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
    createdUsers.push(body.user.id);

    return { id: body.user.id, username, token: body.accessToken };
  }

  async function createGame(
    host: TestUser,
    overrides: Record<string, unknown> = {},
  ): Promise<GameBody> {
    const response = await http()
      .post('/api/v1/games')
      .set(auth(host))
      .send({
        sportId: basketballId,
        title: 'Join Request Pickup',
        requiredPlayers: 10,
        gameDate: addDays(now.date, 3),
        startTime: '18:00',
        endTime: '20:00',
        locationName: 'BGC Court',
        ...overrides,
      })
      .expect(201);
    return response.body as GameBody;
  }

  async function askToJoin(
    player: TestUser,
    gameId: string,
    message?: string,
  ): Promise<JoinRequestBody> {
    const response = await http()
      .post(requestsOf(gameId))
      .set(auth(player))
      .send(message === undefined ? {} : { message })
      .expect(201);
    return response.body as JoinRequestBody;
  }

  const messageOf = (body: unknown) =>
    ([] as string[]).concat((body as ErrorBody).message).join(' ');

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    const basketball = await prisma.sport.findFirstOrThrow({
      where: { name: 'Basketball' },
      select: { id: true },
    });
    basketballId = basketball.id;
  });

  afterAll(async () => {
    await prisma.gameParticipant.deleteMany({
      where: { userId: { in: createdUsers } },
    });
    await prisma.joinRequest.deleteMany({
      where: { userId: { in: createdUsers } },
    });
    await prisma.game.deleteMany({ where: { hostId: { in: createdUsers } } });
    await prisma.post.deleteMany({ where: { userId: { in: createdUsers } } });
    await prisma.reel.deleteMany({ where: { userId: { in: createdUsers } } });
    await prisma.club.deleteMany({ where: { id: { in: createdClubs } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await app.close();
  });

  it('rejects every join request route without a signed-in user', async () => {
    const base = requestsOf(UNKNOWN_UUID);
    await http().post(base).send({}).expect(401);
    await http().get(`${base}/me`).expect(401);
    await http().patch(`${base}/me/cancel`).expect(401);
    await http().get(base).expect(401);
    await http().patch(`${base}/${UNKNOWN_UUID}/accept`).expect(401);
    await http().patch(`${base}/${UNKNOWN_UUID}/reject`).expect(401);
  });

  it('does not accept a private-club request after the player loses membership', async () => {
    const host = await register('clubhost');
    const player = await register('clubplayer');
    const club = await prisma.club.create({
      data: {
        ownerId: host.id,
        name: 'Private Pickup',
        slug: `jr-private-${suffix}`,
        sportId: basketballId,
        isPublic: false,
        maxMembers: 10,
        members: {
          create: [{ userId: player.id, role: 'MEMBER', status: 'ACTIVE' }],
        },
      },
    });
    createdClubs.push(club.id);
    const game = await createGame(host, { clubId: club.id });
    const pending = await askToJoin(player, game.id);
    const post = await prisma.post.create({
      data: { userId: host.id, clubId: club.id, caption: 'Club post' },
    });
    const reel = await prisma.reel.create({
      data: {
        userId: host.id,
        clubId: club.id,
        videoUrl: 'https://example.test/club.mp4',
      },
    });
    const contentPaths = [
      `/api/v1/games/${game.id}`,
      `/api/v1/posts/${post.id}`,
      `/api/v1/reels/${reel.id}`,
    ];
    for (const path of contentPaths)
      await http().get(path).set(auth(player)).expect(200);
    await prisma.club.update({
      where: { id: club.id },
      data: { isActive: false },
    });
    for (const path of contentPaths) {
      await http().get(path).set(auth(player)).expect(404);
      await http().get(path).set(auth(host)).expect(200);
    }
    await http()
      .patch(`${requestsOf(game.id)}/${pending.id}/accept`)
      .set(auth(host))
      .expect(409);
    await prisma.club.update({
      where: { id: club.id },
      data: { isActive: true },
    });
    await prisma.clubMember.update({
      where: { clubId_userId: { clubId: club.id, userId: player.id } },
      data: { status: 'REMOVED' },
    });
    await http()
      .patch(`${requestsOf(game.id)}/${pending.id}/accept`)
      .set(auth(host))
      .expect(409);
    expect(
      await prisma.gameParticipant.count({
        where: { gameId: game.id, userId: player.id },
      }),
    ).toBe(0);
    expect(
      (
        await prisma.joinRequest.findUniqueOrThrow({
          where: { id: pending.id },
        })
      ).status,
    ).toBe('PENDING');
  });

  it('creates a PENDING request with the requester from the token and shows it under /me', async () => {
    const host = await register('host1');
    const player = await register('player1');
    const game = await createGame(host);

    const created = await askToJoin(player, game.id, '  I play point guard.  ');
    expect(created).toMatchObject({
      gameId: game.id,
      userId: player.id,
      message: 'I play point guard.',
      status: 'PENDING',
      respondedAt: null,
    });
    expect(Object.keys(created).sort()).toEqual(
      [
        'createdAt',
        'gameId',
        'id',
        'message',
        'respondedAt',
        'status',
        'updatedAt',
        'userId',
      ].sort(),
    );

    const mine = await http()
      .get(`${requestsOf(game.id)}/me`)
      .set(auth(player))
      .expect(200);
    expect((mine.body as { joinRequest: JoinRequestBody }).joinRequest.id).toBe(
      created.id,
    );

    const none = await http()
      .get(`${requestsOf(game.id)}/me`)
      .set(auth(host))
      .expect(200);
    expect(none.body).toEqual({ joinRequest: null });

    const noMessage = await askToJoin(await register('quiet'), game.id, '   ');
    expect(noMessage.message).toBeNull();
  });

  it('trusts nothing else from the client: extra fields, a long message, and non-text are 400', async () => {
    const host = await register('host2');
    const player = await register('player2');
    const game = await createGame(host);
    const base = requestsOf(game.id);

    for (const extra of [
      { userId: host.id },
      { status: 'ACCEPTED' },
      { gameId: UNKNOWN_UUID },
    ]) {
      await http().post(base).set(auth(player)).send(extra).expect(400);
    }

    const long = await http()
      .post(base)
      .set(auth(player))
      .send({ message: 'x'.repeat(301) })
      .expect(400);
    expect(messageOf(long.body)).toContain('at most 300 characters');

    await http().post(base).set(auth(player)).send({ message: 42 }).expect(400);

    await http()
      .get(`${base}/me`)
      .set(auth(player))
      .expect(200)
      .expect({ joinRequest: null });
  });

  it('refuses a request from the host on their own game', async () => {
    const host = await register('host3');
    const game = await createGame(host);

    const response = await http()
      .post(requestsOf(game.id))
      .set(auth(host))
      .send({})
      .expect(403);
    expect(messageOf(response.body)).toContain("You're hosting this game");
  });

  it('refuses a duplicate while one is pending, and after it was accepted or declined', async () => {
    const host = await register('host4');
    const player = await register('player4');
    const declined = await register('declined4');
    const game = await createGame(host);

    const pending = await askToJoin(player, game.id);
    const duplicate = await http()
      .post(requestsOf(game.id))
      .set(auth(player))
      .send({})
      .expect(409);
    expect(messageOf(duplicate.body)).toBe(
      'You already asked to join this game.',
    );

    await http()
      .patch(`${requestsOf(game.id)}/${pending.id}/accept`)
      .set(auth(host))
      .expect(200);
    await http()
      .post(requestsOf(game.id))
      .set(auth(player))
      .send({})
      .expect(409);

    const refused = await askToJoin(declined, game.id);
    await http()
      .patch(`${requestsOf(game.id)}/${refused.id}/reject`)
      .set(auth(host))
      .expect(200);
    const again = await http()
      .post(requestsOf(game.id))
      .set(auth(declined))
      .send({})
      .expect(409);
    expect(messageOf(again.body)).toContain('declined');

    expect(
      await prisma.joinRequest.count({
        where: { gameId: game.id, userId: player.id },
      }),
    ).toBe(1);
  });

  it('answers 404 for a malformed or unknown game id and for a hidden game', async () => {
    const host = await register('host5');
    const player = await register('player5');

    await http()
      .post(requestsOf('not-a-uuid'))
      .set(auth(player))
      .send({})
      .expect(404);
    const unknown = await http()
      .post(requestsOf(UNKNOWN_UUID))
      .set(auth(player))
      .send({})
      .expect(404);
    expect(messageOf(unknown.body)).toBe('Game not found.');
    await http()
      .get(`${requestsOf(UNKNOWN_UUID)}/me`)
      .set(auth(player))
      .expect(404);

    const game = await createGame(host);
    await prisma.friendship.create({
      data: {
        requesterId: host.id,
        receiverId: player.id,
        pairKey: toPairKey(host.id, player.id),
        status: 'BLOCKED',
        blockedById: host.id,
      },
    });
    await http()
      .post(requestsOf(game.id))
      .set(auth(player))
      .send({})
      .expect(404);
  });

  it('only OPEN games that have not started take requests', async () => {
    const host = await register('host6');
    const player = await register('player6');

    const cancelled = await createGame(host);
    await http()
      .patch(`/api/v1/games/${cancelled.id}/cancel`)
      .set(auth(host))
      .expect(200);
    const onCancelled = await http()
      .post(requestsOf(cancelled.id))
      .set(auth(player))
      .send({})
      .expect(409);
    expect(messageOf(onCancelled.body)).toBe('This game was cancelled.');

    const completed = await createGame(host);
    await prisma.game.update({
      where: { id: completed.id },
      data: { status: 'COMPLETED' },
    });
    const onCompleted = await http()
      .post(requestsOf(completed.id))
      .set(auth(player))
      .send({})
      .expect(409);
    expect(messageOf(onCompleted.body)).toBe('This game is already over.');

    const active = await createGame(host);
    await prisma.game.update({
      where: { id: active.id },
      data: { status: 'ACTIVE' },
    });
    await http()
      .post(requestsOf(active.id))
      .set(auth(player))
      .send({})
      .expect(409);

    const started = await createGame(host);
    const yesterday = addDays(now.date, -1);
    await prisma.game.update({
      where: { id: started.id },
      data: {
        gameDate: new Date(`${yesterday}T00:00:00.000Z`),
        startTime: new Date(`${yesterday}T18:00:00.000Z`),
        endTime: new Date(`${yesterday}T20:00:00.000Z`),
      },
    });
    const onStarted = await http()
      .post(requestsOf(started.id))
      .set(auth(player))
      .send({})
      .expect(409);
    expect(messageOf(onStarted.body)).toBe('This game has already started.');

    expect(
      await prisma.joinRequest.count({ where: { userId: player.id } }),
    ).toBe(0);
  });

  it('lets only the host list requests, with public profile fields only and pending first', async () => {
    const host = await register('host7');
    const first = await register('first7');
    const second = await register('second7');
    const outsider = await register('outsider7');
    const game = await createGame(host);

    const early = await askToJoin(first, game.id, 'Early bird');
    await askToJoin(second, game.id);
    await http()
      .patch(`${requestsOf(game.id)}/${early.id}/reject`)
      .set(auth(host))
      .expect(200);

    for (const user of [first, outsider]) {
      const denied = await http()
        .get(requestsOf(game.id))
        .set(auth(user))
        .expect(403);
      expect(messageOf(denied.body)).toBe(
        'Only the host can manage join requests for this game.',
      );
    }

    const response = await http()
      .get(requestsOf(game.id))
      .set(auth(host))
      .expect(200);
    const list = response.body as HostJoinRequestBody[];
    expect(list.map((item) => [item.userId, item.status])).toEqual([
      [second.id, 'PENDING'],
      [first.id, 'REJECTED'],
    ]);
    expect(list[1]).toMatchObject({ message: 'Early bird' });
    expect(Object.keys(list[0].user).sort()).toEqual(
      [
        'displayName',
        'firstName',
        'id',
        'lastName',
        'profileImageUrl',
        'username',
      ].sort(),
    );
    expect(list[0].user).toMatchObject({
      id: second.id,
      username: second.username,
      firstName: 'E2E',
      lastName: 'second7',
    });

    const serialized = JSON.stringify(response.body);
    for (const key of SENSITIVE_KEYS) {
      expect(serialized).not.toContain(`"${key}"`);
    }

    const hostView = await http()
      .get(`/api/v1/games/${game.id}`)
      .set(auth(host))
      .expect(200);
    expect((hostView.body as GameBody).pendingRequestCount).toBe(1);
    const playerView = await http()
      .get(`/api/v1/games/${game.id}`)
      .set(auth(second))
      .expect(200);
    expect((playerView.body as GameBody).pendingRequestCount).toBeNull();
  });

  it('lets only the host accept; accepting seats the player as ACTIVE', async () => {
    const host = await register('host8');
    const player = await register('player8');
    const other = await register('other8');
    const game = await createGame(host);
    const pending = await askToJoin(player, game.id);
    const accept = `${requestsOf(game.id)}/${pending.id}/accept`;

    for (const user of [player, other]) {
      await http().patch(accept).set(auth(user)).expect(403);
    }

    const response = await http().patch(accept).set(auth(host)).expect(200);
    const accepted = response.body as HostJoinRequestBody;
    expect(accepted).toMatchObject({
      id: pending.id,
      status: 'ACCEPTED',
      user: { id: player.id },
    });
    expect(accepted.respondedAt).not.toBeNull();

    const after = await http()
      .get(`/api/v1/games/${game.id}`)
      .set(auth(host))
      .expect(200);
    expect(after.body as GameBody).toMatchObject({
      status: 'OPEN',
      currentPlayers: 1,
      pendingRequestCount: 0,
    });
    const seat = await prisma.gameParticipant.findUnique({
      where: { gameId_userId: { gameId: game.id, userId: player.id } },
      select: { status: true },
    });
    expect(seat?.status).toBe('ACTIVE');

    const mine = await http()
      .get(`${requestsOf(game.id)}/me`)
      .set(auth(player))
      .expect(200);
    expect(
      (mine.body as { joinRequest: JoinRequestBody }).joinRequest.status,
    ).toBe('ACCEPTED');
  });

  it('lets the host reject; the row is kept as REJECTED', async () => {
    const host = await register('host9');
    const player = await register('player9');
    const game = await createGame(host);
    const pending = await askToJoin(player, game.id);
    const reject = `${requestsOf(game.id)}/${pending.id}/reject`;

    await http().patch(reject).set(auth(player)).expect(403);

    const response = await http().patch(reject).set(auth(host)).expect(200);
    expect(response.body as HostJoinRequestBody).toMatchObject({
      id: pending.id,
      status: 'REJECTED',
    });
    expect((response.body as JoinRequestBody).respondedAt).not.toBeNull();

    const row = await prisma.joinRequest.findUnique({
      where: { id: pending.id },
      select: { status: true },
    });
    expect(row?.status).toBe('REJECTED');
  });

  it('lets only the requester cancel their own pending request, then ask again', async () => {
    const host = await register('host10');
    const player = await register('player10');
    const other = await register('other10');
    const game = await createGame(host);
    const pending = await askToJoin(player, game.id, 'First try');
    const cancel = `${requestsOf(game.id)}/me/cancel`;

    const notTheirs = await http().patch(cancel).set(auth(other)).expect(404);
    expect(messageOf(notTheirs.body)).toBe('Join request not found.');
    await http().patch(cancel).set(auth(host)).expect(404);
    expect(
      (await prisma.joinRequest.findUnique({ where: { id: pending.id } }))
        ?.status,
    ).toBe('PENDING');

    const response = await http().patch(cancel).set(auth(player)).expect(200);
    expect(response.body as JoinRequestBody).toMatchObject({
      id: pending.id,
      status: 'CANCELLED',
    });

    const again = await askToJoin(player, game.id, 'Second try');
    expect(again).toMatchObject({
      id: pending.id,
      status: 'PENDING',
      message: 'Second try',
    });
    expect(
      await prisma.joinRequest.count({
        where: { gameId: game.id, userId: player.id },
      }),
    ).toBe(1);
  });

  it('rejects every move out of a settled state', async () => {
    const host = await register('host11');
    const player = await register('player11');
    const quitter = await register('quitter11');
    const game = await createGame(host);
    const base = requestsOf(game.id);

    const accepted = await askToJoin(player, game.id);
    await http()
      .patch(`${base}/${accepted.id}/accept`)
      .set(auth(host))
      .expect(200);

    const acceptAgain = await http()
      .patch(`${base}/${accepted.id}/accept`)
      .set(auth(host))
      .expect(409);
    expect(messageOf(acceptAgain.body)).toBe(
      'This request was already accepted.',
    );
    await http()
      .patch(`${base}/${accepted.id}/reject`)
      .set(auth(host))
      .expect(409);
    await http().patch(`${base}/me/cancel`).set(auth(player)).expect(409);

    const cancelled = await askToJoin(quitter, game.id);
    await http().patch(`${base}/me/cancel`).set(auth(quitter)).expect(200);
    await http().patch(`${base}/me/cancel`).set(auth(quitter)).expect(409);
    const acceptCancelled = await http()
      .patch(`${base}/${cancelled.id}/accept`)
      .set(auth(host))
      .expect(409);
    expect(messageOf(acceptCancelled.body)).toBe('This request was cancelled.');
    await http()
      .patch(`${base}/${cancelled.id}/reject`)
      .set(auth(host))
      .expect(409);
  });

  it('refuses a request id that belongs to another game, or is unknown', async () => {
    const host = await register('host12');
    const player = await register('player12');
    const gameA = await createGame(host);
    const gameB = await createGame(host);
    const onA = await askToJoin(player, gameA.id);

    for (const action of ['accept', 'reject']) {
      const response = await http()
        .patch(`${requestsOf(gameB.id)}/${onA.id}/${action}`)
        .set(auth(host))
        .expect(404);
      expect(messageOf(response.body)).toBe('Join request not found.');
      await http()
        .patch(`${requestsOf(gameA.id)}/${UNKNOWN_UUID}/${action}`)
        .set(auth(host))
        .expect(404);
      await http()
        .patch(`${requestsOf(gameA.id)}/not-a-uuid/${action}`)
        .set(auth(host))
        .expect(404);
    }

    expect(
      (await prisma.joinRequest.findUnique({ where: { id: onA.id } }))?.status,
    ).toBe('PENDING');
  });

  it('refuses to accept when the game is FULL or no longer OPEN', async () => {
    const host = await register('host13');
    const first = await register('first13');
    const second = await register('second13');
    const late = await register('late13');

    const small = await createGame(host, { requiredPlayers: 1 });
    const a = await askToJoin(first, small.id);
    const b = await askToJoin(second, small.id);
    await http()
      .patch(`${requestsOf(small.id)}/${a.id}/accept`)
      .set(auth(host))
      .expect(200);
    const noSlot = await http()
      .patch(`${requestsOf(small.id)}/${b.id}/accept`)
      .set(auth(host))
      .expect(409);
    expect(messageOf(noSlot.body)).toBe('This game is already full.');
    expect(
      (await prisma.joinRequest.findUnique({ where: { id: b.id } }))?.status,
    ).toBe('PENDING');

    const closing = await createGame(host);
    const pending = await askToJoin(late, closing.id);
    await http()
      .patch(`/api/v1/games/${closing.id}/cancel`)
      .set(auth(host))
      .expect(200);
    const onCancelled = await http()
      .patch(`${requestsOf(closing.id)}/${pending.id}/accept`)
      .set(auth(host))
      .expect(409);
    expect(messageOf(onCancelled.body)).toBe('This game was cancelled.');
    await http()
      .patch(`${requestsOf(closing.id)}/${pending.id}/reject`)
      .set(auth(host))
      .expect(200);
  });

  it('decides simultaneous answers one at a time: one wins, the rest get 409', async () => {
    const host = await register('host14');
    const players = await Promise.all(
      ['a', 'b', 'c'].map((name) => register(`race14${name}`)),
    );
    const game = await createGame(host, { requiredPlayers: 1 });
    const requests = await Promise.all(
      players.map((player) => askToJoin(player, game.id)),
    );

    const accepts = await Promise.all(
      requests.map((pending) =>
        http()
          .patch(`${requestsOf(game.id)}/${pending.id}/accept`)
          .set(auth(host)),
      ),
    );
    expect(accepts.map((response) => response.status).sort()).toEqual([
      200, 409, 409,
    ]);
    expect(
      await prisma.joinRequest.count({
        where: { gameId: game.id, status: 'ACCEPTED' },
      }),
    ).toBe(1);

    const single = await createGame(host);
    const racer = await register('race14d');
    const pending = await askToJoin(racer, single.id);
    const answers = await Promise.all([
      http()
        .patch(`${requestsOf(single.id)}/${pending.id}/accept`)
        .set(auth(host)),
      http()
        .patch(`${requestsOf(single.id)}/${pending.id}/reject`)
        .set(auth(host)),
      http()
        .patch(`${requestsOf(single.id)}/me/cancel`)
        .set(auth(racer)),
    ]);
    expect(answers.filter((response) => response.status === 200)).toHaveLength(
      1,
    );
    expect(answers.filter((response) => response.status === 409)).toHaveLength(
      2,
    );
  });

  it('never returns sensitive fields and keeps the standard error shape', async () => {
    const host = await register('host15');
    const player = await register('player15');
    const game = await createGame(host);
    const created = await askToJoin(player, game.id);

    const bodies = [
      created,
      (
        await http()
          .get(`${requestsOf(game.id)}/me`)
          .set(auth(player))
          .expect(200)
      ).body as unknown,
      (
        await http()
          .patch(`${requestsOf(game.id)}/${created.id}/accept`)
          .set(auth(host))
          .expect(200)
      ).body as unknown,
    ];
    for (const body of bodies) {
      const serialized = JSON.stringify(body);
      for (const key of SENSITIVE_KEYS) {
        expect(serialized).not.toContain(`"${key}"`);
      }
    }

    const error = await http()
      .post(requestsOf(game.id))
      .set(auth(host))
      .send({})
      .expect(403);
    expect(error.body as ErrorBody).toMatchObject({ success: false });
    expect(JSON.stringify(error.body)).not.toMatch(/prisma|stack/i);
  });
});
