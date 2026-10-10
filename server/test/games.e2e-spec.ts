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
  title: string;
  description: string | null;
  sport: { id: string; name: string };
  host: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
  club: { id: string; name: string } | null;
  requiredPlayers: number;
  currentPlayers: number;
  remainingSlots: number;
  status: string;
  gameDate: string;
  startTime: string;
  endTime: string | null;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  isHost: boolean;
  canEdit: boolean;
  canCancel: boolean;
}

interface ErrorBody {
  message: string | string[];
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * Real database. Throwaway users, their games and clubs, and one throwaway inactive
 * sport are created here and removed afterwards; seeded sports are only read.
 */
describe('Games (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const createdUsers: string[] = [];
  const clubIds: string[] = [];
  let retiredSportId = '';
  let basketballId = '';
  let tennisId = '';

  const now = localMoment(readGameTimezone(process.env.GAME_TIMEZONE));
  const inDays = (days: number) => addDays(now.date, days);

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });
  const games = '/api/v1/games';

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_game_${name}_${suffix}`;
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

  function gamePayload(overrides: Record<string, unknown> = {}) {
    return {
      sportId: basketballId,
      title: 'Sunday Pickup Basketball',
      description: 'Friendly 5v5, all levels.',
      requiredPlayers: 12,
      gameDate: inDays(4),
      startTime: '18:00',
      endTime: '20:00',
      locationName: 'BGC Court',
      ...overrides,
    };
  }

  it('refuses an edit when the game is cancelled after the initial permission check', async () => {
    const host = await register('cancelrace');
    const game = await createGame(host);
    const original = prisma.game.update.bind(prisma.game);
    const interleaved = jest
      .spyOn(prisma.game, 'update')
      .mockImplementationOnce((args) => {
        const operation = prisma.game
          .updateMany({
            where: { id: game.id },
            data: { status: 'CANCELLED' },
          })
          .then(() => original(args));
        // Only the awaited result is used by the service, not Prisma's relation methods.
        return operation as unknown as ReturnType<typeof prisma.game.update>;
      });
    try {
      await http()
        .patch(`${games}/${game.id}`)
        .set(auth(host))
        .send({ title: 'Stale edit' })
        .expect(409);
      const saved = await prisma.game.findUniqueOrThrow({
        where: { id: game.id },
      });
      expect(saved.title).toBe(game.title);
      expect(saved.status).toBe('CANCELLED');
    } finally {
      interleaved.mockRestore();
    }
  });

  async function createGame(
    host: TestUser,
    overrides: Record<string, unknown> = {},
  ): Promise<GameBody> {
    const response = await http()
      .post(games)
      .set(auth(host))
      .send(gamePayload(overrides))
      .expect(201);
    return response.body as GameBody;
  }

  async function createClub(
    owner: TestUser,
    name: string,
    isPublic: boolean,
  ): Promise<string> {
    const response = await http()
      .post('/api/v1/clubs')
      .set(auth(owner))
      .send({
        name: `E2E Game Club ${name}`,
        username: `e2e-game-${name}-${suffix}`,
        description: 'Throwaway club for game tests.',
        primarySportId: basketballId,
        maxMembers: 20,
        membershipType: 'OPEN',
        isPublic,
      })
      .expect(201);
    const clubId = (response.body as { id: string }).id;
    clubIds.push(clubId);
    return clubId;
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

    const sports = await prisma.sport.findMany({
      where: { name: { in: ['Basketball', 'Tennis'] } },
      select: { id: true, name: true },
    });
    basketballId = sports.find((sport) => sport.name === 'Basketball')!.id;
    tennisId = sports.find((sport) => sport.name === 'Tennis')!.id;

    const retired = await prisma.sport.create({
      data: { name: `E2E Game Inactive ${suffix}`, isActive: false },
      select: { id: true },
    });
    retiredSportId = retired.id;
  });

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { hostId: { in: createdUsers } } });
    const conversations = await prisma.conversation.findMany({
      where: { clubId: { in: clubIds } },
      select: { id: true },
    });
    await prisma.conversation.deleteMany({
      where: { id: { in: conversations.map(({ id }) => id) } },
    });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.sport.deleteMany({ where: { id: retiredSportId } });
    await app.close();
  });

  it('rejects every game route without a signed-in user', async () => {
    await http().post(games).send({}).expect(401);
    await http().get(games).expect(401);
    await http().get(`${games}/mine`).expect(401);
    await http().get(`${games}/${UNKNOWN_UUID}`).expect(401);
    await http().patch(`${games}/${UNKNOWN_UUID}`).send({}).expect(401);
    await http().patch(`${games}/${UNKNOWN_UUID}/cancel`).expect(401);
  });

  it('creates an OPEN game with 0 players, exact date and times, and safe host fields', async () => {
    const host = await register('create');
    const game = await createGame(host);

    expect(game).toMatchObject({
      title: 'Sunday Pickup Basketball',
      description: 'Friendly 5v5, all levels.',
      sport: { id: basketballId, name: 'Basketball' },
      host: {
        id: host.id,
        username: host.username,
        firstName: 'E2E',
        lastName: 'create',
      },
      club: null,
      requiredPlayers: 12,
      currentPlayers: 0,
      remainingSlots: 12,
      status: 'OPEN',
      gameDate: inDays(4),
      startTime: '18:00',
      endTime: '20:00',
      locationName: 'BGC Court',
      latitude: null,
      longitude: null,
      isHost: true,
      canEdit: true,
      canCancel: true,
    });
    const raw = JSON.stringify(game);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('email');
    expect(raw).not.toContain('dateOfBirth');

    // No participant rows are invented for the host.
    expect(
      await prisma.gameParticipant.count({ where: { gameId: game.id } }),
    ).toBe(0);
    const row = await prisma.game.findUniqueOrThrow({
      where: { id: game.id },
    });
    expect(row.hostId).toBe(host.id);
    expect(row.status).toBe('OPEN');

    // Coordinates are optional but, when given, stored as a pair.
    const pinned = await createGame(host, {
      latitude: 14.5509,
      longitude: 121.0503,
    });
    expect(pinned).toMatchObject({ latitude: 14.5509, longitude: 121.0503 });
  });

  it('takes the host from the JWT and refuses hostId, status, or counts in the body', async () => {
    const host = await register('jwt');
    const other = await register('jwtother');

    for (const extra of [
      { hostId: other.id },
      { status: 'FULL' },
      { currentPlayers: 5 },
      { createdAt: '2020-01-01T00:00:00Z' },
    ]) {
      await http()
        .post(games)
        .set(auth(host))
        .send(gamePayload(extra))
        .expect(400);
    }

    const game = await createGame(host);
    expect(game.host.id).toBe(host.id);
    expect(await prisma.game.count({ where: { hostId: other.id } })).toBe(0);
  });

  it('rejects an unknown, malformed, missing, or inactive sport', async () => {
    const host = await register('sport');
    const create = (body: Record<string, unknown>) =>
      http().post(games).set(auth(host)).send(body);

    const unknown = await create(gamePayload({ sportId: UNKNOWN_UUID })).expect(
      404,
    );
    expect(messageOf(unknown.body)).toBe('Sport not found.');
    await create(gamePayload({ sportId: 'basketball' })).expect(400);
    await create(gamePayload({ sportId: undefined })).expect(400);

    const inactive = await create(
      gamePayload({ sportId: retiredSportId }),
    ).expect(404);
    expect(messageOf(inactive.body)).toBe('Sport not found.');
    expect(await prisma.game.count({ where: { hostId: host.id } })).toBe(0);
  });

  it('validates required players, title, description, and location', async () => {
    const host = await register('fields');
    const create = (overrides: Record<string, unknown>) =>
      http().post(games).set(auth(host)).send(gamePayload(overrides));

    for (const requiredPlayers of [0, -3, 1.5, 101, '12', null]) {
      await create({ requiredPlayers }).expect(400);
    }
    const zero = await create({ requiredPlayers: 0 }).expect(400);
    expect(messageOf(zero.body)).toContain(
      'Required players must be at least 1.',
    );

    await create({ title: '  ab ' }).expect(400);
    await create({ title: 'x'.repeat(81) }).expect(400);
    await create({ description: 'x'.repeat(501) }).expect(400);
    await create({ locationName: '   ' }).expect(400);
    await create({ locationName: 'x'.repeat(121) }).expect(400);

    const trimmed = await createGame(host, {
      title: '  Morning Run Club  ',
      description: '   ',
      requiredPlayers: 1,
      locationName: '  UP Oval ',
    });
    expect(trimmed).toMatchObject({
      title: 'Morning Run Club',
      description: null,
      requiredPlayers: 1,
      locationName: 'UP Oval',
    });
  });

  it('rejects invalid and past dates', async () => {
    const host = await register('date');
    const create = (overrides: Record<string, unknown>) =>
      http().post(games).set(auth(host)).send(gamePayload(overrides));

    await create({ gameDate: '2026-02-30' }).expect(400);
    await create({ gameDate: '04/10/2026' }).expect(400);
    await create({ gameDate: 'tomorrow' }).expect(400);
    const past = await create({ gameDate: inDays(-1) }).expect(400);
    expect(messageOf(past.body)).toBe('Choose today or a future date.');
    await create({ gameDate: inDays(366) }).expect(400);
    expect(await prisma.game.count({ where: { hostId: host.id } })).toBe(0);
  });

  it('rejects invalid times and an end time that is not after the start', async () => {
    const host = await register('time');
    const create = (overrides: Record<string, unknown>) =>
      http().post(games).set(auth(host)).send(gamePayload(overrides));

    const equal = await create({ startTime: '18:00', endTime: '18:00' }).expect(
      400,
    );
    expect(messageOf(equal.body)).toBe(
      'End time must be after the start time.',
    );
    await create({ startTime: '20:00', endTime: '18:00' }).expect(400);
    await create({ startTime: '25:00' }).expect(400);
    await create({ endTime: '6pm' }).expect(400);
    await create({ endTime: undefined }).expect(400);
    expect(await prisma.game.count({ where: { hostId: host.id } })).toBe(0);
  });

  it('rejects out-of-range or half-given coordinates', async () => {
    const host = await register('coords');
    const create = (overrides: Record<string, unknown>) =>
      http().post(games).set(auth(host)).send(gamePayload(overrides));

    await create({ latitude: 91, longitude: 121 }).expect(400);
    await create({ latitude: 14.5, longitude: -181 }).expect(400);
    await create({ latitude: '14.5', longitude: '121' }).expect(400);
    const half = await create({ latitude: 14.5 }).expect(400);
    expect(messageOf(half.body)).toBe(
      'Give both latitude and longitude, or neither.',
    );
    expect(await prisma.game.count({ where: { hostId: host.id } })).toBe(0);
  });

  it('checks the club: unknown is 404, non-members are 403, active members host', async () => {
    const owner = await register('clubowner');
    const outsider = await register('clubout');
    const clubId = await createClub(owner, 'pub', true);

    const unknown = await http()
      .post(games)
      .set(auth(owner))
      .send(gamePayload({ clubId: UNKNOWN_UUID }))
      .expect(404);
    expect(messageOf(unknown.body)).toBe('Club not found.');
    await http()
      .post(games)
      .set(auth(owner))
      .send(gamePayload({ clubId: 'my-club' }))
      .expect(400);

    const refused = await http()
      .post(games)
      .set(auth(outsider))
      .send(gamePayload({ clubId }))
      .expect(403);
    expect(messageOf(refused.body)).toBe(
      'Only active members of this club can host club games.',
    );

    const clubGame = await createGame(owner, { clubId });
    expect(clubGame.club?.id).toBe(clubId);
    expect(clubGame.host.id).toBe(owner.id);

    // A private club's games are hidden from non-members.
    const privateClubId = await createClub(owner, 'priv', false);
    const privateGame = await createGame(owner, { clubId: privateClubId });
    await http()
      .get(`${games}/${privateGame.id}`)
      .set(auth(outsider))
      .expect(404);
    await http().get(`${games}/${clubGame.id}`).set(auth(outsider)).expect(200);

    await prisma.club.update({
      where: { id: clubId },
      data: { isActive: false },
    });
    await http()
      .post(games)
      .set(auth(owner))
      .send(gamePayload({ clubId }))
      .expect(403);
  });

  it('lets only the host edit, and never lets an edit change the status', async () => {
    const host = await register('edit');
    const other = await register('editother');
    const game = await createGame(host);

    const refused = await http()
      .patch(`${games}/${game.id}`)
      .set(auth(other))
      .send({ title: 'Hijacked Game' })
      .expect(403);
    expect(messageOf(refused.body)).toBe('Only the host can change this game.');

    const updated = await http()
      .patch(`${games}/${game.id}`)
      .set(auth(host))
      .send({
        title: 'Evening Pickup Basketball',
        requiredPlayers: 10,
        gameDate: inDays(5),
        startTime: '19:00',
        endTime: '21:30',
        latitude: 14.6,
        longitude: 121.0,
        description: null,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      id: game.id,
      title: 'Evening Pickup Basketball',
      requiredPlayers: 10,
      gameDate: inDays(5),
      startTime: '19:00',
      endTime: '21:30',
      latitude: 14.6,
      longitude: 121,
      description: null,
      status: 'OPEN',
      currentPlayers: 0,
    });

    await http()
      .patch(`${games}/${game.id}`)
      .set(auth(host))
      .send({ status: 'COMPLETED' })
      .expect(400);
    await http()
      .patch(`${games}/${game.id}`)
      .set(auth(host))
      .send({ hostId: other.id })
      .expect(400);
    await http()
      .patch(`${games}/${game.id}`)
      .set(auth(host))
      .send({ endTime: '18:00' })
      .expect(400);

    const row = await prisma.game.findUniqueOrThrow({
      where: { id: game.id },
    });
    expect(row).toMatchObject({
      hostId: host.id,
      title: 'Evening Pickup Basketball',
      status: 'OPEN',
    });
  });

  it('lets the host cancel, keeps the row, and blocks edits afterwards', async () => {
    const host = await register('cancel');
    const other = await register('cancelother');
    const game = await createGame(host);

    await http()
      .patch(`${games}/${game.id}/cancel`)
      .set(auth(other))
      .expect(403);

    const cancelled = await http()
      .patch(`${games}/${game.id}/cancel`)
      .set(auth(host))
      .expect(200);
    expect(cancelled.body).toMatchObject({
      id: game.id,
      status: 'CANCELLED',
      canEdit: false,
      canCancel: false,
    });

    const again = await http()
      .patch(`${games}/${game.id}/cancel`)
      .set(auth(host))
      .expect(409);
    expect(messageOf(again.body)).toBe('This game is already cancelled.');
    await http()
      .patch(`${games}/${game.id}`)
      .set(auth(host))
      .send({ title: 'Back From The Dead' })
      .expect(409);

    // Cancelling never deletes: the row and its details stay.
    const row = await prisma.game.findUnique({ where: { id: game.id } });
    expect(row?.status).toBe('CANCELLED');
    expect(row?.title).toBe('Sunday Pickup Basketball');
    const detail = await http()
      .get(`${games}/${game.id}`)
      .set(auth(other))
      .expect(200);
    expect((detail.body as GameBody).status).toBe('CANCELLED');
  });

  it('returns one game, and 404 for unknown, malformed, or blocked-host games', async () => {
    const host = await register('get');
    const viewer = await register('getviewer');
    const blocker = await register('getblocker');
    const game = await createGame(host, {
      latitude: 14.55,
      longitude: 121.05,
    });

    const detail = await http()
      .get(`${games}/${game.id}`)
      .set(auth(viewer))
      .expect(200);
    expect(detail.body).toMatchObject({
      id: game.id,
      sport: { name: 'Basketball' },
      host: { id: host.id },
      requiredPlayers: 12,
      currentPlayers: 0,
      status: 'OPEN',
      locationName: 'BGC Court',
      latitude: 14.55,
      longitude: 121.05,
      isHost: false,
      canEdit: false,
      canCancel: false,
    });

    const unknown = await http()
      .get(`${games}/${UNKNOWN_UUID}`)
      .set(auth(viewer))
      .expect(404);
    expect(messageOf(unknown.body)).toBe('Game not found.');
    await http().get(`${games}/not-a-uuid`).set(auth(viewer)).expect(404);

    await prisma.friendship.create({
      data: {
        requesterId: host.id,
        receiverId: blocker.id,
        pairKey: toPairKey(host.id, blocker.id),
        status: 'BLOCKED',
        blockedById: host.id,
      },
    });
    await http().get(`${games}/${game.id}`).set(auth(blocker)).expect(404);
  });

  it('lists upcoming games soonest first, hides cancelled ones, and lists your hosted games', async () => {
    const host = await register('list');
    const viewer = await register('listviewer');
    const later = await createGame(host, {
      gameDate: inDays(9),
      startTime: '07:00',
      endTime: '09:00',
    });
    const soonLate = await createGame(host, {
      gameDate: inDays(8),
      startTime: '19:00',
      endTime: '21:00',
    });
    const soonEarly = await createGame(host, {
      gameDate: inDays(8),
      startTime: '06:00',
      endTime: '08:00',
    });
    const cancelled = await createGame(host, { gameDate: inDays(8) });
    await http()
      .patch(`${games}/${cancelled.id}/cancel`)
      .set(auth(host))
      .expect(200);

    const ours = new Set([later.id, soonLate.id, soonEarly.id, cancelled.id]);
    const listed = await http()
      .get(games)
      .query({ limit: 50 })
      .set(auth(viewer))
      .expect(200);
    const listedIds = (listed.body as GameBody[])
      .map((game) => game.id)
      .filter((id) => ours.has(id));
    expect(listedIds).toEqual([soonEarly.id, soonLate.id, later.id]);

    const onlyCancelled = await http()
      .get(games)
      .query({ status: 'CANCELLED', limit: 50 })
      .set(auth(viewer))
      .expect(200);
    expect(
      (onlyCancelled.body as GameBody[]).some(
        (game) => game.id === cancelled.id,
      ),
    ).toBe(true);
    expect(
      (onlyCancelled.body as GameBody[]).every(
        (game) => game.status === 'CANCELLED',
      ),
    ).toBe(true);

    const mine = await http().get(`${games}/mine`).set(auth(host)).expect(200);
    expect((mine.body as GameBody[]).map((game) => game.id).sort()).toEqual(
      [...ours].sort(),
    );
    const viewerMine = await http()
      .get(`${games}/mine`)
      .set(auth(viewer))
      .expect(200);
    expect(viewerMine.body).toEqual([]);

    await http()
      .get(games)
      .query({ status: 'DELETED' })
      .set(auth(viewer))
      .expect(400);
    await http().get(games).query({ limit: 500 }).set(auth(viewer)).expect(400);
  });

  it('filters by sport', async () => {
    const host = await register('sportfilter');
    const hoops = await createGame(host, { gameDate: inDays(10) });
    const tennis = await createGame(host, {
      sportId: tennisId,
      title: 'Doubles Tennis',
      requiredPlayers: 4,
      gameDate: inDays(10),
    });

    const response = await http()
      .get(games)
      .query({ sportId: tennisId, limit: 50 })
      .set(auth(host))
      .expect(200);
    const list = response.body as GameBody[];
    expect(list.every((game) => game.sport.id === tennisId)).toBe(true);
    expect(list.some((game) => game.id === tennis.id)).toBe(true);
    expect(list.some((game) => game.id === hoops.id)).toBe(false);

    await http()
      .get(games)
      .query({ sportId: 'tennis' })
      .set(auth(host))
      .expect(400);
  });

  it('filters by a specific date and by today', async () => {
    const host = await register('datefilter');
    const first = await createGame(host, { gameDate: inDays(3) });
    const second = await createGame(host, { gameDate: inDays(6) });

    const onDate = await http()
      .get(games)
      .query({ gameDate: inDays(3), limit: 50 })
      .set(auth(host))
      .expect(200);
    const dated = onDate.body as GameBody[];
    expect(dated.every((game) => game.gameDate === inDays(3))).toBe(true);
    expect(dated.some((game) => game.id === first.id)).toBe(true);
    expect(dated.some((game) => game.id === second.id)).toBe(false);

    const hour = Number(now.time.slice(0, 2));
    if (hour <= 21) {
      const start = `${String(hour + 1).padStart(2, '0')}:00`;
      const end = `${String(hour + 2).padStart(2, '0')}:00`;
      const today = await createGame(host, {
        gameDate: now.date,
        startTime: start,
        endTime: end,
      });
      const todayList = await http()
        .get(games)
        .query({ gameDate: 'today', limit: 50 })
        .set(auth(host))
        .expect(200);
      const todays = todayList.body as GameBody[];
      expect(todays.every((game) => game.gameDate === now.date)).toBe(true);
      expect(todays.some((game) => game.id === today.id)).toBe(true);
      expect(todays.some((game) => game.id === first.id)).toBe(false);
    }

    await http()
      .get(games)
      .query({ gameDate: '2026-02-30' })
      .set(auth(host))
      .expect(400);
  });
});
