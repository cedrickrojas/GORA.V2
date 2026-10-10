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

interface DiscoveredGame {
  id: string;
  title: string;
  sport: { id: string; name: string };
  host: Record<string, unknown>;
  gameDate: string;
  startTime: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  currentPlayers: number;
  requiredPlayers: number;
  status: string;
  isHost: boolean;
  isPlayer: boolean;
  myJoinRequestStatus: string | null;
}

interface DiscoveryBody {
  games: DiscoveredGame[];
  dateFrom: string;
  dateTo: string | null;
  distanceKm: number | null;
}

interface ErrorBody {
  success: boolean;
  message: string | string[];
}

interface GameOptions {
  title: string;
  sportId?: string;
  gameDate?: string;
  requiredPlayers?: number;
  /** Kilometres north of CENTER; null = no coordinates. */
  northKm?: number | null;
}

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';
const KM_PER_DEGREE_LATITUDE = 111.19;
/** Open ocean, far from any real game, so radius results only hold this suite's games. */
const CENTER = { latitude: -45.1234, longitude: -140.5678 };
const HOST_KEYS = [
  'displayName',
  'firstName',
  'id',
  'lastName',
  'profileImageUrl',
  'username',
];
const GAME_KEYS = [
  'club',
  'currentPlayers',
  'distanceKm',
  'endTime',
  'gameDate',
  'host',
  'id',
  'isHost',
  'isPlayer',
  'latitude',
  'locationName',
  'longitude',
  'myJoinRequestStatus',
  'remainingSlots',
  'requiredPlayers',
  'sport',
  'startTime',
  'status',
  'title',
];

/**
 * Real database. Throwaway users and their games, requests, and seats are created here
 * and removed afterwards; nothing else is touched. Discovery only reads.
 */
describe('Game discovery (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const createdUsers: string[] = [];
  let basketballId = '';
  let volleyballId = '';
  let host: TestUser;
  let viewer: TestUser;

  const now = localMoment(readGameTimezone(process.env.GAME_TIMEZONE));
  const gameDay = addDays(now.date, 3);

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_gd_${name}_${suffix}`;
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
    owner: TestUser,
    options: GameOptions,
  ): Promise<string> {
    const northKm = options.northKm === undefined ? 0 : options.northKm;
    const coordinates =
      northKm === null
        ? {}
        : {
            latitude: CENTER.latitude + northKm / KM_PER_DEGREE_LATITUDE,
            longitude: CENTER.longitude,
          };
    const response = await http()
      .post('/api/v1/games')
      .set(auth(owner))
      .send({
        sportId: options.sportId ?? basketballId,
        title: options.title,
        requiredPlayers: options.requiredPlayers ?? 10,
        gameDate: options.gameDate ?? gameDay,
        startTime: '18:00',
        endTime: '20:00',
        locationName: `Discovery Court ${suffix}`,
        ...coordinates,
      })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  async function seat(
    owner: TestUser,
    gameId: string,
    player: TestUser,
  ): Promise<void> {
    const requested = await http()
      .post(`/api/v1/games/${gameId}/join-requests`)
      .set(auth(player))
      .send({})
      .expect(201);
    await http()
      .patch(
        `/api/v1/games/${gameId}/join-requests/${(requested.body as { id: string }).id}/accept`,
      )
      .set(auth(owner))
      .expect(200);
  }

  async function discover(
    user: TestUser,
    query: Record<string, string | number>,
  ): Promise<DiscoveryBody> {
    const response = await http()
      .get('/api/v1/games/discover')
      .query({ limit: 100, ...query })
      .set(auth(user))
      .expect(200);
    return response.body as DiscoveryBody;
  }

  const around = (radiusKm?: number): Record<string, number> => ({
    latitude: CENTER.latitude,
    longitude: CENTER.longitude,
    ...(radiusKm === undefined ? {} : { distanceKm: radiusKm }),
  });

  const idsOf = (body: DiscoveryBody): string[] =>
    body.games.map((game) => game.id);

  const expectBadRequest = async (query: Record<string, string>) => {
    const response = await http()
      .get('/api/v1/games/discover')
      .query(query)
      .set(auth(viewer))
      .expect(400);
    expect((response.body as ErrorBody).success).toBe(false);
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    const [basketball, volleyball] = await Promise.all([
      prisma.sport.findFirstOrThrow({
        where: { name: 'Basketball' },
        select: { id: true },
      }),
      prisma.sport.findFirstOrThrow({
        where: { name: 'Volleyball' },
        select: { id: true },
      }),
    ]);
    basketballId = basketball.id;
    volleyballId = volleyball.id;
    [host, viewer] = await Promise.all([register('host'), register('viewer')]);
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

  it('requires a signed-in user', async () => {
    await http().get('/api/v1/games/discover').expect(401);
  });

  it('returns real games with only the discovery fields and a safe host', async () => {
    const gameId = await createGame(host, {
      title: 'Shape Check',
      northKm: 0.4,
    });
    const body = await discover(viewer, around(1));
    const game = body.games.find((item) => item.id === gameId);

    expect(game).toBeDefined();
    expect(Object.keys(game!).sort()).toEqual(GAME_KEYS);
    expect(Object.keys(game!.host).sort()).toEqual(HOST_KEYS);
    expect(game!.host.username).toBe(host.username);
    expect(game!.sport).toEqual(
      expect.objectContaining({ id: basketballId, name: 'Basketball' }),
    );
    expect(game!.gameDate).toBe(gameDay);
    expect(game!.startTime).toBe('18:00');
    expect(game!.isHost).toBe(false);

    const raw = JSON.stringify(body);
    for (const secret of ['passwordHash', 'email', 'dateOfBirth', 'token']) {
      expect(raw).not.toContain(secret);
    }
    expect(body.distanceKm).toBe(1);
  });

  it('filters by sport id and answers 404 for an unknown sport', async () => {
    const volleyball = await createGame(host, {
      title: 'Sport Filter Volleyball',
      sportId: volleyballId,
      northKm: 0.2,
    });
    const basketball = await createGame(host, {
      title: 'Sport Filter Basketball',
      northKm: 0.2,
    });

    const volleyballOnly = await discover(viewer, {
      ...around(1),
      sportId: volleyballId,
    });
    expect(idsOf(volleyballOnly)).toContain(volleyball);
    expect(idsOf(volleyballOnly)).not.toContain(basketball);
    expect(
      volleyballOnly.games.every((game) => game.sport.id === volleyballId),
    ).toBe(true);

    await http()
      .get('/api/v1/games/discover')
      .query({ sportId: UNKNOWN_UUID })
      .set(auth(viewer))
      .expect(404);
    await expectBadRequest({ sportId: 'volleyball' });
  });

  it('filters by date: one day, tomorrow, and this week', async () => {
    const tomorrow = addDays(now.date, 1);
    const later = addDays(now.date, 10);
    const tomorrowGame = await createGame(host, {
      title: 'Date Tomorrow',
      gameDate: tomorrow,
      northKm: 0.3,
    });
    const laterGame = await createGame(host, {
      title: 'Date Later',
      gameDate: later,
      northKm: 0.3,
    });

    const oneDay = await discover(viewer, { ...around(1), date: later });
    expect(idsOf(oneDay)).toContain(laterGame);
    expect(idsOf(oneDay)).not.toContain(tomorrowGame);
    expect(oneDay.games.every((game) => game.gameDate === later)).toBe(true);
    expect([oneDay.dateFrom, oneDay.dateTo]).toEqual([later, later]);

    const tomorrowOnly = await discover(viewer, {
      ...around(1),
      date: 'tomorrow',
    });
    expect(idsOf(tomorrowOnly)).toContain(tomorrowGame);
    expect(idsOf(tomorrowOnly)).not.toContain(laterGame);

    const week = await discover(viewer, { ...around(1), date: 'this-week' });
    expect(idsOf(week)).toContain(tomorrowGame);
    expect(idsOf(week)).not.toContain(laterGame);
    expect([week.dateFrom, week.dateTo]).toEqual([
      now.date,
      addDays(now.date, 6),
    ]);

    const upcoming = await discover(viewer, around(1));
    expect(idsOf(upcoming)).toEqual(
      expect.arrayContaining([tomorrowGame, laterGame]),
    );
    expect(upcoming.dateTo).toBeNull();

    await expectBadRequest({ date: 'next-month' });
    await expectBadRequest({ date: '2026-02-30' });
  });

  it('filters by status and never lists CANCELLED games', async () => {
    const full = await createGame(host, {
      title: 'Status Full',
      requiredPlayers: 1,
      northKm: 0.6,
    });
    await seat(host, full, viewer);
    const cancelled = await createGame(host, {
      title: 'Status Cancelled',
      northKm: 0.6,
    });
    await http()
      .patch(`/api/v1/games/${cancelled}/cancel`)
      .set(auth(host))
      .expect(200);

    const fullOnly = await discover(viewer, { ...around(1), status: 'FULL' });
    expect(idsOf(fullOnly)).toContain(full);
    expect(fullOnly.games.every((game) => game.status === 'FULL')).toBe(true);

    const byDefault = await discover(viewer, around(1));
    expect(idsOf(byDefault)).toContain(full);
    expect(idsOf(byDefault)).not.toContain(cancelled);
    expect(byDefault.games.some((game) => game.status === 'CANCELLED')).toBe(
      false,
    );

    await expectBadRequest({ status: 'CANCELLED' });
    await expectBadRequest({ status: 'open' });
  });

  it('leaves COMPLETED games out unless they are asked for', async () => {
    const completed = await createGame(host, {
      title: 'Status Completed',
      northKm: 0.7,
    });
    await prisma.game.update({
      where: { id: completed },
      data: { status: 'COMPLETED' },
    });

    expect(idsOf(await discover(viewer, around(1)))).not.toContain(completed);
    expect(
      idsOf(await discover(viewer, { ...around(1), status: 'COMPLETED' })),
    ).toContain(completed);
  });

  it('rejects an invalid latitude', async () => {
    for (const latitude of ['91', '-90.5', 'abc', '', '12,5']) {
      await expectBadRequest({ latitude, longitude: '121' });
    }
  });

  it('rejects an invalid longitude and half a center', async () => {
    for (const longitude of ['181', '-180.01', 'east', '']) {
      await expectBadRequest({ latitude: '14.5', longitude });
    }
    await expectBadRequest({ latitude: '14.5' });
    await expectBadRequest({ longitude: '121' });
    await expectBadRequest({ distanceKm: '10' });
    await expectBadRequest({ ...toText(around()), distanceKm: '0' });
    await expectBadRequest({ ...toText(around()), distanceKm: '101' });
    await expectBadRequest({ limit: '0' });
  });

  it('measures the distance from the center and sorts nearest first', async () => {
    const far = await createGame(host, { title: 'Distance 8 km', northKm: 8 });
    const near = await createGame(host, { title: 'Distance 3 km', northKm: 3 });

    const body = await discover(viewer, around(10));
    const distances = body.games.map((game) => game.distanceKm ?? -1);

    expect(body.games.find((game) => game.id === near)?.distanceKm).toBeCloseTo(
      3,
      1,
    );
    expect(body.games.find((game) => game.id === far)?.distanceKm).toBeCloseTo(
      8,
      1,
    );
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(idsOf(body).indexOf(near)).toBeLessThan(idsOf(body).indexOf(far));
  });

  it('keeps only games within 1 km for a 1 km radius', async () => {
    const inside = await createGame(host, {
      title: 'Radius 1 in',
      northKm: 0.9,
    });
    const outside = await createGame(host, {
      title: 'Radius 1 out',
      northKm: 1.2,
    });

    const body = await discover(viewer, around(1));
    expect(idsOf(body)).toContain(inside);
    expect(idsOf(body)).not.toContain(outside);
    expect(body.games.every((game) => (game.distanceKm ?? 99) <= 1)).toBe(true);
  });

  it('keeps only games within 10 km for a 10 km radius', async () => {
    const inside = await createGame(host, {
      title: 'Radius 10 in',
      northKm: 9.5,
    });
    const outside = await createGame(host, {
      title: 'Radius 10 out',
      northKm: 30,
    });

    const body = await discover(viewer, around(10));
    expect(idsOf(body)).toContain(inside);
    expect(idsOf(body)).not.toContain(outside);
    expect(body.games.every((game) => (game.distanceKm ?? 99) <= 10)).toBe(
      true,
    );
    expect(idsOf(await discover(viewer, around(50)))).toContain(outside);
  });

  it('never puts a game without coordinates in radius results', async () => {
    const date = addDays(now.date, 5);
    const unlocated = await createGame(host, {
      title: 'No Coordinates',
      gameDate: date,
      northKm: null,
    });
    const located = await createGame(host, {
      title: 'With Coordinates',
      gameDate: date,
      northKm: 0.5,
    });

    const radius = await discover(viewer, { ...around(100), date });
    expect(idsOf(radius)).toContain(located);
    expect(idsOf(radius)).not.toContain(unlocated);

    const list = await discover(viewer, { date });
    const listed = list.games.find((game) => game.id === unlocated);
    expect(listed).toEqual(
      expect.objectContaining({
        latitude: null,
        longitude: null,
        distanceKm: null,
      }),
    );

    const anyDistance = await discover(viewer, { ...around(), date });
    const ids = idsOf(anyDistance);
    expect(ids).toEqual(expect.arrayContaining([located, unlocated]));
    expect(ids.indexOf(located)).toBeLessThan(ids.indexOf(unlocated));
    expect(anyDistance.distanceKm).toBeNull();
  });

  it('returns several sports at one location', async () => {
    const date = addDays(now.date, 6);
    const basketball = await createGame(host, {
      title: 'Same Place Basketball',
      gameDate: date,
      northKm: 0.1,
    });
    const volleyball = await createGame(host, {
      title: 'Same Place Volleyball',
      sportId: volleyballId,
      gameDate: date,
      northKm: 0.1,
    });

    const body = await discover(viewer, { ...around(1), date });
    const games = body.games.filter((game) =>
      [basketball, volleyball].includes(game.id),
    );
    expect(games.map((game) => game.sport.name).sort()).toEqual([
      'Basketball',
      'Volleyball',
    ]);
    expect(new Set(games.map((game) => game.latitude)).size).toBe(1);
  });

  it('returns several games at one location', async () => {
    const date = addDays(now.date, 7);
    const first = await createGame(host, {
      title: 'Same Place Early',
      gameDate: date,
      northKm: 0.15,
    });
    const second = await createGame(host, {
      title: 'Same Place Late',
      gameDate: date,
      northKm: 0.15,
    });

    const body = await discover(viewer, { ...around(1), date });
    expect(idsOf(body)).toEqual(expect.arrayContaining([first, second]));
  });

  it('counts players from ACTIVE GameParticipant rows and shows the viewer state', async () => {
    const date = addDays(now.date, 8);
    const gameId = await createGame(host, {
      title: 'Player Count',
      gameDate: date,
      requiredPlayers: 4,
      northKm: 0.25,
    });
    const [playerA, playerB, asker] = await Promise.all([
      register('pa'),
      register('pb'),
      register('asker'),
    ]);
    await seat(host, gameId, playerA);
    await seat(host, gameId, playerB);
    await http()
      .post(`/api/v1/games/${gameId}/join-requests`)
      .set(auth(asker))
      .send({})
      .expect(201);

    const find = async (user: TestUser) =>
      (await discover(user, { ...around(1), date })).games.find(
        (game) => game.id === gameId,
      );

    expect(await find(viewer)).toEqual(
      expect.objectContaining({
        currentPlayers: 2,
        requiredPlayers: 4,
        isPlayer: false,
        myJoinRequestStatus: null,
      }),
    );
    expect((await find(asker))?.myJoinRequestStatus).toBe('PENDING');
    expect((await find(playerA))?.isPlayer).toBe(true);
    expect((await find(host))?.isHost).toBe(true);

    await http()
      .patch(`/api/v1/games/${gameId}/players/me/leave`)
      .set(auth(playerB))
      .expect(200);
    expect((await find(viewer))?.currentPlayers).toBe(1);
  });

  it('hides games of a host who blocked the viewer and changes nothing', async () => {
    const date = addDays(now.date, 9);
    const blocker = await register('blocker');
    const gameId = await createGame(blocker, {
      title: 'Blocked Host',
      gameDate: date,
      northKm: 0.35,
    });
    const before = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      select: { status: true, updatedAt: true },
    });

    expect(idsOf(await discover(viewer, { ...around(1), date }))).toContain(
      gameId,
    );

    await prisma.friendship.create({
      data: {
        requesterId: blocker.id,
        receiverId: viewer.id,
        pairKey: toPairKey(blocker.id, viewer.id),
        status: 'BLOCKED',
        blockedById: blocker.id,
      },
    });
    expect(idsOf(await discover(viewer, { ...around(1), date }))).not.toContain(
      gameId,
    );

    const after = await prisma.game.findUniqueOrThrow({
      where: { id: gameId },
      select: { status: true, updatedAt: true },
    });
    expect(after).toEqual(before);
  });
});

function toText(query: Record<string, number>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
}
