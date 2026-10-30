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
  autoAccept: boolean;
  status: string;
  currentPlayers: number;
  requiredPlayers: number;
  remainingSlots: number;
  isPlayer: boolean;
}

interface RosterBody {
  gameId: string;
  requiredPlayers: number;
  currentPlayers: number;
  availableSlots: number;
  status: string;
  players: Array<Record<string, unknown> & { id: string; username: string }>;
}

interface ParticipationBody {
  gameId: string;
  status: string;
  joinedAt: string | null;
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
 * Real database. Throwaway users, their games, requests, and seats are created here and
 * removed afterwards; nothing else is touched.
 */
describe('Game players (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const createdUsers: string[] = [];
  let basketballId = '';

  const now = localMoment(readGameTimezone(process.env.GAME_TIMEZONE));

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });
  const playersOf = (gameId: string) => `/api/v1/games/${gameId}/players`;
  const requestsOf = (gameId: string) =>
    `/api/v1/games/${gameId}/join-requests`;

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_gp_${name}_${suffix}`;
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

  const registerMany = (prefix: string, count: number) =>
    Promise.all(
      Array.from({ length: count }, (_, index) =>
        register(`${prefix}${index + 1}`),
      ),
    );

  async function createGame(
    host: TestUser,
    requiredPlayers: number,
    autoAccept = false,
  ): Promise<GameBody> {
    const response = await http()
      .post('/api/v1/games')
      .set(auth(host))
      .send({
        sportId: basketballId,
        title: 'Roster Pickup',
        requiredPlayers,
        autoAccept,
        gameDate: addDays(now.date, 3),
        startTime: '18:00',
        endTime: '20:00',
        locationName: 'BGC Court',
      })
      .expect(201);
    return response.body as GameBody;
  }

  async function askToJoin(player: TestUser, gameId: string): Promise<string> {
    const response = await http()
      .post(requestsOf(gameId))
      .set(auth(player))
      .send({})
      .expect(201);
    return (response.body as { id: string }).id;
  }

  const accept = (host: TestUser, gameId: string, requestId: string) =>
    http()
      .patch(`${requestsOf(gameId)}/${requestId}/accept`)
      .set(auth(host));

  /** Join request + acceptance, one player after another (seat order = join order). */
  async function seat(
    host: TestUser,
    gameId: string,
    players: TestUser[],
  ): Promise<void> {
    for (const player of players) {
      const requestId = await askToJoin(player, gameId);
      await accept(host, gameId, requestId).expect(200);
    }
  }

  async function roster(viewer: TestUser, gameId: string): Promise<RosterBody> {
    const response = await http()
      .get(playersOf(gameId))
      .set(auth(viewer))
      .expect(200);
    return response.body as RosterBody;
  }

  async function gameOf(viewer: TestUser, gameId: string): Promise<GameBody> {
    const response = await http()
      .get(`/api/v1/games/${gameId}`)
      .set(auth(viewer))
      .expect(200);
    return response.body as GameBody;
  }

  const rowOf = (gameId: string, userId: string) =>
    prisma.gameParticipant.findUnique({
      where: { gameId_userId: { gameId, userId } },
      select: { status: true },
    });

  const activeCount = (gameId: string) =>
    prisma.gameParticipant.count({ where: { gameId, status: 'ACTIVE' } });

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
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await app.close();
  });

  it('rejects every player route without a signed-in user', async () => {
    const base = playersOf(UNKNOWN_UUID);
    await http().get(base).expect(401);
    await http().get(`${base}/me`).expect(401);
    await http().patch(`${base}/me/leave`).expect(401);
    await http().patch(`${base}/${UNKNOWN_UUID}/remove`).expect(401);
    await http().get('/api/v1/games/playing').expect(401);
  });

  it('starts every game at 0 players; the host is not a participant', async () => {
    const host = await register('host1');
    const game = await createGame(host, 12);

    expect(game).toMatchObject({
      status: 'OPEN',
      currentPlayers: 0,
      remainingSlots: 12,
      isPlayer: false,
    });
    expect(await roster(host, game.id)).toEqual({
      gameId: game.id,
      requiredPlayers: 12,
      currentPlayers: 0,
      availableSlots: 12,
      status: 'OPEN',
      players: [],
    });
    const mine = await http()
      .get(`${playersOf(game.id)}/me`)
      .set(auth(host))
      .expect(200);
    expect((mine.body as ParticipationBody).status).toBe('NOT_A_PLAYER');
    expect(
      await prisma.gameParticipant.count({ where: { gameId: game.id } }),
    ).toBe(0);
  });

  it('accepting a request marks it ACCEPTED and seats the player as ACTIVE, together', async () => {
    const host = await register('host2');
    const player = await register('player2');
    const game = await createGame(host, 12);
    const requestId = await askToJoin(player, game.id);

    await accept(host, game.id, requestId).expect(200);

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      select: { status: true, respondedAt: true },
    });
    expect(joinRequest?.status).toBe('ACCEPTED');
    expect(joinRequest?.respondedAt).not.toBeNull();
    expect((await rowOf(game.id, player.id))?.status).toBe('ACTIVE');

    const mine = await http()
      .get(`${playersOf(game.id)}/me`)
      .set(auth(player))
      .expect(200);
    expect(mine.body as ParticipationBody).toMatchObject({
      gameId: game.id,
      status: 'ACTIVE',
    });
    expect((mine.body as ParticipationBody).joinedAt).not.toBeNull();

    expect(await gameOf(player, game.id)).toMatchObject({
      currentPlayers: 1,
      isPlayer: true,
    });

    const accepted = await prisma.joinRequest.findMany({
      where: { gameId: game.id, status: 'ACCEPTED' },
      select: { userId: true },
    });
    for (const { userId } of accepted) {
      expect((await rowOf(game.id, userId))?.status).toBe('ACTIVE');
    }
  });

  it('approval mode changes are host-only and new games default to manual', async () => {
    const host = await register('approvalhost');
    const outsider = await register('approvalother');
    const game = await createGame(host, 4);
    expect(game.autoAccept).toBe(false);
    await http()
      .patch(`/api/v1/games/${game.id}`)
      .set(auth(outsider))
      .send({ autoAccept: true })
      .expect(403);
    const enabled = await http()
      .patch(`/api/v1/games/${game.id}`)
      .set(auth(host))
      .send({ autoAccept: true })
      .expect(200);
    expect((enabled.body as GameBody).autoAccept).toBe(true);
    const disabled = await http()
      .patch(`/api/v1/games/${game.id}`)
      .set(auth(host))
      .send({ autoAccept: false })
      .expect(200);
    expect((disabled.body as GameBody).autoAccept).toBe(false);
    for (const invalid of ['true', null, 1]) {
      await http()
        .patch(`/api/v1/games/${game.id}`)
        .set(auth(host))
        .send({ autoAccept: invalid })
        .expect(400);
    }
  });

  it('auto approval gives the last slot to only one concurrent requester', async () => {
    const host = await register('autohost');
    const contenders = await registerMany('autoplayer', 3);
    const game = await createGame(host, 1, true);
    const responses = await Promise.all(
      contenders.map((player) =>
        http().post(requestsOf(game.id)).set(auth(player)).send({}),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409, 409,
    ]);
    const accepted = responses.find((response) => response.status === 201)!;
    expect(
      accepted.body as { status: string; respondedAt: string | null },
    ).toMatchObject({ status: 'ACCEPTED' });
    expect(
      (accepted.body as { respondedAt: string | null }).respondedAt,
    ).not.toBeNull();
    expect(await gameOf(host, game.id)).toMatchObject({
      currentPlayers: 1,
      status: 'FULL',
    });
    expect(
      await prisma.joinRequest.count({
        where: { gameId: game.id, status: 'ACCEPTED' },
      }),
    ).toBe(1);
    expect(
      await prisma.gameParticipant.count({
        where: { gameId: game.id, status: 'ACTIVE' },
      }),
    ).toBe(1);
  });

  it('approval mode applies to new requests and keeps pending requests available for manual review', async () => {
    const host = await register('switchhost');
    const [waiting, automatic, manual] = await registerMany('switchplayer', 3);
    const game = await createGame(host, 4);
    const pendingId = await askToJoin(waiting, game.id);
    expect(await rowOf(game.id, waiting.id)).toBeNull();
    await http()
      .patch(`/api/v1/games/${game.id}`)
      .set(auth(host))
      .send({ autoAccept: true })
      .expect(200);
    await askToJoin(automatic, game.id);
    expect((await rowOf(game.id, automatic.id))?.status).toBe('ACTIVE');
    expect(
      (await prisma.joinRequest.findUniqueOrThrow({ where: { id: pendingId } }))
        .status,
    ).toBe('PENDING');
    await accept(host, game.id, pendingId).expect(200);
    await http()
      .patch(`/api/v1/games/${game.id}`)
      .set(auth(host))
      .send({ autoAccept: false })
      .expect(200);
    await askToJoin(manual, game.id);
    expect(await rowOf(game.id, manual.id)).toBeNull();
    expect(await gameOf(host, game.id)).toMatchObject({ currentPlayers: 2 });
  });

  it('auto approval preserves cancellation history and reuses a seat when the player rejoins', async () => {
    const host = await register('reautohost');
    const player = await register('reautoplayer');
    const game = await createGame(host, 2, true);
    const requestId = await askToJoin(player, game.id);
    await http()
      .patch(`${playersOf(game.id)}/me/leave`)
      .set(auth(player))
      .expect(200);
    const history = await http()
      .get('/api/v1/games/joined')
      .set(auth(player))
      .expect(200);
    expect(
      (history.body as Array<{ id: string; participationStatus: string }>).find(
        (entry) => entry.id === game.id,
      ),
    ).toMatchObject({ participationStatus: 'LEFT', isPlayer: false });
    expect(await askToJoin(player, game.id)).toBe(requestId);
    expect((await rowOf(game.id, player.id))?.status).toBe('ACTIVE');
    expect(
      await prisma.gameParticipant.count({
        where: { gameId: game.id, userId: player.id },
      }),
    ).toBe(1);
    await http()
      .patch(`/api/v1/games/${game.id}/cancel`)
      .set(auth(host))
      .expect(200);
    const late = await register('autocancelled');
    await http().post(requestsOf(game.id)).set(auth(late)).send({}).expect(409);
    await http()
      .patch(`/api/v1/games/${game.id}`)
      .set(auth(host))
      .send({ autoAccept: false })
      .expect(409);
  });

  it('returns 3/12 with a roster in join order, everywhere the count is shown', async () => {
    const host = await register('host3');
    const players = await registerMany('three', 3);
    const game = await createGame(host, 12);
    await seat(host, game.id, players);

    const list = await roster(players[0], game.id);
    expect(list).toMatchObject({
      requiredPlayers: 12,
      currentPlayers: 3,
      availableSlots: 9,
      status: 'OPEN',
    });
    expect(list.players.map((player) => player.id)).toEqual(
      players.map((player) => player.id),
    );
    expect(list.players[0]).toMatchObject({
      username: players[0].username,
      firstName: 'E2E',
      lastName: 'three1',
    });

    expect((await gameOf(host, game.id)).currentPlayers).toBe(3);
    const hosted = await http()
      .get('/api/v1/games/mine')
      .set(auth(host))
      .expect(200);
    expect(
      (hosted.body as GameBody[]).find((item) => item.id === game.id)
        ?.currentPlayers,
    ).toBe(3);
    const playing = await http()
      .get('/api/v1/games/playing')
      .set(auth(players[1]))
      .expect(200);
    expect(
      (playing.body as GameBody[]).find((item) => item.id === game.id),
    ).toMatchObject({ currentPlayers: 3, isPlayer: true });
  });

  it('fills to 12/12 FULL and never lets a 13th player in', async () => {
    const host = await register('host4');
    const players = await registerMany('twelve', 12);
    const [late, waiting] = await registerMany('extra', 2);
    const game = await createGame(host, 12);

    await seat(host, game.id, players.slice(0, 11));
    const waitingRequest = await askToJoin(waiting, game.id);
    await seat(host, game.id, players.slice(11));

    const full = await roster(host, game.id);
    expect(full).toMatchObject({
      currentPlayers: 12,
      availableSlots: 0,
      status: 'FULL',
    });
    expect(full.players).toHaveLength(12);

    const newRequest = await http()
      .post(requestsOf(game.id))
      .set(auth(late))
      .send({})
      .expect(409);
    expect(messageOf(newRequest.body)).toBe('This game is already full.');

    const oldRequest = await accept(host, game.id, waitingRequest).expect(409);
    expect(messageOf(oldRequest.body)).toBe('This game is already full.');
    expect(
      (await prisma.joinRequest.findUnique({ where: { id: waitingRequest } }))
        ?.status,
    ).toBe('PENDING');

    await expect(
      prisma.gameParticipant.create({
        data: { gameId: game.id, userId: late.id, status: 'ACTIVE' },
      }),
    ).rejects.toThrow();
    expect(await activeCount(game.id)).toBe(12);
    expect(await gameOf(host, game.id)).toMatchObject({
      currentPlayers: 12,
      status: 'FULL',
    });
  });

  it('lets a player leave (ACTIVE -> LEFT, row kept), which reopens a FULL game', async () => {
    const host = await register('host5');
    const [first, second] = await registerMany('leave', 2);
    const outsider = await register('outsider5');
    const game = await createGame(host, 2);
    await seat(host, game.id, [first, second]);
    expect((await gameOf(host, game.id)).status).toBe('FULL');

    const left = await http()
      .patch(`${playersOf(game.id)}/me/leave`)
      .set(auth(first))
      .expect(200);
    expect(left.body as ParticipationBody).toMatchObject({ status: 'LEFT' });
    expect((await rowOf(game.id, first.id))?.status).toBe('LEFT');
    expect(await roster(host, game.id)).toMatchObject({
      currentPlayers: 1,
      availableSlots: 1,
      status: 'OPEN',
    });

    const again = await http()
      .patch(`${playersOf(game.id)}/me/leave`)
      .set(auth(first))
      .expect(409);
    expect(messageOf(again.body)).toBe('You already left this game.');

    for (const user of [host, outsider]) {
      const response = await http()
        .patch(`${playersOf(game.id)}/me/leave`)
        .set(auth(user))
        .expect(404);
      expect(messageOf(response.body)).toBe(
        "You're not a player in this game.",
      );
    }
    expect((await rowOf(game.id, second.id))?.status).toBe('ACTIVE');

    const playing = await http()
      .get('/api/v1/games/playing')
      .set(auth(first))
      .expect(200);
    expect(
      (playing.body as GameBody[]).some((item) => item.id === game.id),
    ).toBe(false);
  });

  it('lets only the host remove an ACTIVE player (-> REMOVED), which reopens a FULL game', async () => {
    const host = await register('host6');
    const [first, second] = await registerMany('remove', 2);
    const outsider = await register('outsider6');
    const game = await createGame(host, 2);
    await seat(host, game.id, [first, second]);
    const removeUrl = (userId: string) =>
      `${playersOf(game.id)}/${userId}/remove`;

    for (const user of [first, outsider]) {
      const denied = await http()
        .patch(removeUrl(second.id))
        .set(auth(user))
        .expect(403);
      expect(messageOf(denied.body)).toBe(
        'Only the host can manage players in this game.',
      );
    }
    expect((await rowOf(game.id, second.id))?.status).toBe('ACTIVE');

    const removed = await http()
      .patch(removeUrl(second.id))
      .set(auth(host))
      .expect(200);
    expect(removed.body as RosterBody).toMatchObject({
      currentPlayers: 1,
      availableSlots: 1,
      status: 'OPEN',
    });
    expect(
      (removed.body as RosterBody).players.map((player) => player.id),
    ).toEqual([first.id]);
    expect((await rowOf(game.id, second.id))?.status).toBe('REMOVED');

    await http().patch(removeUrl(second.id)).set(auth(host)).expect(409);
    const mine = await http()
      .get(`${playersOf(game.id)}/me`)
      .set(auth(second))
      .expect(200);
    expect((mine.body as ParticipationBody).status).toBe('REMOVED');

    await http().patch(removeUrl(outsider.id)).set(auth(host)).expect(404);
    await http().patch(removeUrl(UNKNOWN_UUID)).set(auth(host)).expect(404);
    await http().patch(removeUrl('not-a-uuid')).set(auth(host)).expect(404);
    const self = await http()
      .patch(removeUrl(host.id))
      .set(auth(host))
      .expect(400);
    expect(messageOf(self.body)).toContain("can't remove yourself");
  });

  it('reuses the one participation row on rejoin; two ACTIVE rows can never exist', async () => {
    const host = await register('host7');
    const player = await register('player7');
    const kicked = await register('kicked7');
    const game = await createGame(host, 5);
    await seat(host, game.id, [player, kicked]);

    const duplicate = await http()
      .post(requestsOf(game.id))
      .set(auth(player))
      .send({})
      .expect(409);
    expect(messageOf(duplicate.body)).toBe(
      "You're already a player in this game.",
    );
    await expect(
      prisma.gameParticipant.create({
        data: { gameId: game.id, userId: player.id, status: 'ACTIVE' },
      }),
    ).rejects.toThrow();

    await http()
      .patch(`${playersOf(game.id)}/me/leave`)
      .set(auth(player))
      .expect(200);
    await http()
      .patch(`${playersOf(game.id)}/${kicked.id}/remove`)
      .set(auth(host))
      .expect(200);

    await seat(host, game.id, [player, kicked]);
    for (const user of [player, kicked]) {
      expect(
        await prisma.gameParticipant.count({
          where: { gameId: game.id, userId: user.id },
        }),
      ).toBe(1);
      expect((await rowOf(game.id, user.id))?.status).toBe('ACTIVE');
      expect(
        await prisma.joinRequest.count({
          where: { gameId: game.id, userId: user.id },
        }),
      ).toBe(1);
    }
    expect((await roster(host, game.id)).currentPlayers).toBe(2);
  });

  it('gives the final slot to exactly one of two simultaneous acceptances', async () => {
    const host = await register('host8');
    const [userA, userB] = await registerMany('race', 2);
    const game = await createGame(host, 1);
    const requestA = await askToJoin(userA, game.id);
    const requestB = await askToJoin(userB, game.id);

    const results = await Promise.all([
      accept(host, game.id, requestA),
      accept(host, game.id, requestB),
    ]);

    expect(results.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const loser = results.find((response) => response.status === 409);
    expect(messageOf(loser?.body)).toBe('This game is already full.');

    expect(await activeCount(game.id)).toBe(1);
    const statuses = await prisma.joinRequest.findMany({
      where: { gameId: game.id },
      select: { status: true },
    });
    expect(statuses.map(({ status }) => status).sort()).toEqual([
      'ACCEPTED',
      'PENDING',
    ]);
    expect(await roster(host, game.id)).toMatchObject({
      currentPlayers: 1,
      requiredPlayers: 1,
      availableSlots: 0,
      status: 'FULL',
    });
  });

  it('seats exactly requiredPlayers when many acceptances race for the last slots', async () => {
    const host = await register('host9');
    const players = await registerMany('crowd', 6);
    const game = await createGame(host, 3);
    const requestIds = await Promise.all(
      players.map((player) => askToJoin(player, game.id)),
    );

    const results = await Promise.all(
      requestIds.map((requestId) => accept(host, game.id, requestId)),
    );

    expect(results.filter((response) => response.status === 200)).toHaveLength(
      3,
    );
    expect(results.filter((response) => response.status === 409)).toHaveLength(
      3,
    );
    expect(await activeCount(game.id)).toBe(3);
    expect(
      await prisma.joinRequest.count({
        where: { gameId: game.id, status: 'ACCEPTED' },
      }),
    ).toBe(3);
    expect(await gameOf(host, game.id)).toMatchObject({
      currentPlayers: 3,
      status: 'FULL',
    });
  });

  it('keeps a CANCELLED game CANCELLED when players leave or are removed', async () => {
    const host = await register('host10');
    const [first, second] = await registerMany('cancel', 2);
    const game = await createGame(host, 2);
    await seat(host, game.id, [first, second]);
    await http()
      .patch(`/api/v1/games/${game.id}/cancel`)
      .set(auth(host))
      .expect(200);

    await http()
      .patch(`${playersOf(game.id)}/me/leave`)
      .set(auth(first))
      .expect(200);
    await http()
      .patch(`${playersOf(game.id)}/${second.id}/remove`)
      .set(auth(host))
      .expect(200);

    expect(await gameOf(host, game.id)).toMatchObject({
      status: 'CANCELLED',
      currentPlayers: 0,
    });
  });

  it('never reopens a COMPLETED game: leaving and removing are refused', async () => {
    const host = await register('host11');
    const [first, second] = await registerMany('done', 2);
    const game = await createGame(host, 2);
    await seat(host, game.id, [first, second]);
    await prisma.game.update({
      where: { id: game.id },
      data: { status: 'COMPLETED' },
    });

    const leave = await http()
      .patch(`${playersOf(game.id)}/me/leave`)
      .set(auth(first))
      .expect(409);
    expect(messageOf(leave.body)).toBe('This game is already over.');
    await http()
      .patch(`${playersOf(game.id)}/${second.id}/remove`)
      .set(auth(host))
      .expect(409);

    await prisma.gameParticipant.update({
      where: { gameId_userId: { gameId: game.id, userId: first.id } },
      data: { status: 'LEFT' },
    });
    expect((await gameOf(host, game.id)).status).toBe('COMPLETED');
  });

  it('hides the roster of a hidden game and never returns sensitive fields', async () => {
    const host = await register('host12');
    const player = await register('player12');
    const blocked = await register('blocked12');
    const game = await createGame(host, 4);
    await seat(host, game.id, [player]);

    await prisma.friendship.create({
      data: {
        requesterId: host.id,
        receiverId: blocked.id,
        pairKey: toPairKey(host.id, blocked.id),
        status: 'BLOCKED',
        blockedById: host.id,
      },
    });
    await http().get(playersOf(game.id)).set(auth(blocked)).expect(404);
    await http()
      .get(`${playersOf(game.id)}/me`)
      .set(auth(blocked))
      .expect(404);
    await http().get(playersOf('not-a-uuid')).set(auth(host)).expect(404);

    const list = await roster(host, game.id);
    expect(Object.keys(list.players[0]).sort()).toEqual(
      [
        'displayName',
        'firstName',
        'id',
        'joinedAt',
        'lastName',
        'profileImageUrl',
        'username',
      ].sort(),
    );

    const bodies: unknown[] = [
      list,
      (
        await http()
          .get(`${playersOf(game.id)}/me`)
          .set(auth(player))
          .expect(200)
      ).body,
      (await http().get('/api/v1/games/playing').set(auth(player)).expect(200))
        .body,
    ];
    for (const body of bodies) {
      const serialized = JSON.stringify(body);
      for (const key of SENSITIVE_KEYS) {
        expect(serialized).not.toContain(`"${key}"`);
      }
    }

    const error = await http()
      .patch(`${playersOf(game.id)}/${player.id}/remove`)
      .set(auth(player))
      .expect(403);
    expect(error.body as ErrorBody).toMatchObject({ success: false });
    expect(JSON.stringify(error.body)).not.toMatch(/prisma|stack/i);
  });
});
