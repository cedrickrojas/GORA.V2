import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';
import { PrismaService } from './../src/prisma/prisma.service';

interface TestUser {
  id: string;
  token: string;
}

interface SportBody {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
}

interface UserSportBody {
  sportId: string;
  name: string;
  iconUrl: string | null;
  skillLevel: string;
  position: string | null;
}

interface ErrorBody {
  message: string;
}

const SEEDED_SPORTS = [
  'Badminton',
  'Basketball',
  'Cycling',
  'Football',
  'Running',
  'Swimming',
  'Table Tennis',
  'Tennis',
  'Volleyball',
  'Other',
];
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

/**
 * Real database. Throwaway users and one throwaway inactive sport are created here and
 * removed afterwards; the seeded sports are only read.
 */
describe('Sports and user sports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const createdUsers: string[] = [];
  let retiredSportId = '';
  let sports: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });
  const mySports = '/api/v1/users/me/sports';

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_sport_${name}_${suffix}`;
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

    return { id: body.user.id, token: body.accessToken };
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    const retired = await prisma.sport.create({
      data: { name: `E2E Inactive ${suffix}`, isActive: false },
      select: { id: true },
    });
    retiredSportId = retired.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.userSport.deleteMany({ where: { sportId: retiredSportId } });
    await prisma.sport.deleteMany({ where: { id: retiredSportId } });
    await app.close();
  });

  it('requires a signed-in user for every sports route', async () => {
    await http().get('/api/v1/sports').expect(401);
    await http().get(`/api/v1/sports/${UNKNOWN_UUID}`).expect(401);
    await http().get(mySports).expect(401);
    await http().post(mySports).send({}).expect(401);
    await http().patch(`${mySports}/${UNKNOWN_UUID}`).send({}).expect(401);
    await http().delete(`${mySports}/${UNKNOWN_UUID}`).expect(401);
  });

  it('lists only active sports, each seeded sport exactly once, with public fields only', async () => {
    const user = await register('list');
    const response = await http()
      .get('/api/v1/sports')
      .set(auth(user))
      .expect(200);
    const list = response.body as SportBody[];

    expect(list.map((sport) => sport.name)).toEqual(SEEDED_SPORTS);
    expect(list.every((sport) => sport.isActive)).toBe(true);
    expect(list.some((sport) => sport.id === retiredSportId)).toBe(false);
    for (const sport of list) {
      expect(Object.keys(sport).sort()).toEqual(
        ['description', 'iconUrl', 'id', 'isActive', 'name'].sort(),
      );
    }
    sports = Object.fromEntries(list.map((sport) => [sport.name, sport.id]));
  });

  it('returns one sport by id, including a retired one, and 404 for unknown or invalid ids', async () => {
    const user = await register('one');

    const one = await http()
      .get(`/api/v1/sports/${sports.Basketball}`)
      .set(auth(user))
      .expect(200);
    expect(one.body).toMatchObject({
      id: sports.Basketball,
      name: 'Basketball',
      isActive: true,
    });

    const retired = await http()
      .get(`/api/v1/sports/${retiredSportId}`)
      .set(auth(user))
      .expect(200);
    expect((retired.body as SportBody).isActive).toBe(false);

    const unknown = await http()
      .get(`/api/v1/sports/${UNKNOWN_UUID}`)
      .set(auth(user))
      .expect(404);
    expect((unknown.body as ErrorBody).message).toBe('Sport not found.');
    await http().get('/api/v1/sports/basketball').set(auth(user)).expect(404);
  });

  it('never lets a user create, edit, activate, or delete a sport', async () => {
    const user = await register('readonly');

    await http()
      .post('/api/v1/sports')
      .set(auth(user))
      .send({ name: `Hacked ${suffix}` })
      .expect(404);
    await http()
      .patch(`/api/v1/sports/${retiredSportId}`)
      .set(auth(user))
      .send({ isActive: true })
      .expect(404);
    await http()
      .delete(`/api/v1/sports/${sports.Other}`)
      .set(auth(user))
      .expect(404);

    const retired = await prisma.sport.findUniqueOrThrow({
      where: { id: retiredSportId },
    });
    expect(retired.isActive).toBe(false);
    expect(
      await prisma.sport.count({ where: { name: `Hacked ${suffix}` } }),
    ).toBe(0);
    expect(await prisma.sport.count({ where: { id: sports.Other } })).toBe(1);
  });

  it('adds, lists, updates, and removes your own sport', async () => {
    const user = await register('flow');

    const added = await http()
      .post(mySports)
      .set(auth(user))
      .send({
        sportId: sports.Volleyball,
        skillLevel: 'INTERMEDIATE',
        position: '  Setter  ',
      })
      .expect(201);
    expect(added.body).toMatchObject({
      sportId: sports.Volleyball,
      name: 'Volleyball',
      skillLevel: 'INTERMEDIATE',
      position: 'Setter',
    });
    expect(JSON.stringify(added.body)).not.toContain('userId');

    await http()
      .post(mySports)
      .set(auth(user))
      .send({ sportId: sports.Running, skillLevel: 'BEGINNER' })
      .expect(201);

    const listed = await http().get(mySports).set(auth(user)).expect(200);
    expect(
      (listed.body as UserSportBody[]).map((sport) => [
        sport.name,
        sport.position,
      ]),
    ).toEqual([
      ['Volleyball', 'Setter'],
      ['Running', null],
    ]);

    const updated = await http()
      .patch(`${mySports}/${sports.Volleyball}`)
      .set(auth(user))
      .send({ skillLevel: 'ADVANCED', position: 'Libero' })
      .expect(200);
    expect(updated.body).toMatchObject({
      sportId: sports.Volleyball,
      skillLevel: 'ADVANCED',
      position: 'Libero',
    });

    // Blank clears the position; the sport itself can never be swapped by an edit.
    const cleared = await http()
      .patch(`${mySports}/${sports.Volleyball}`)
      .set(auth(user))
      .send({ position: '' })
      .expect(200);
    expect(cleared.body).toMatchObject({
      skillLevel: 'ADVANCED',
      position: null,
    });
    await http()
      .patch(`${mySports}/${sports.Volleyball}`)
      .set(auth(user))
      .send({ sportId: sports.Tennis })
      .expect(400);

    await http()
      .delete(`${mySports}/${sports.Volleyball}`)
      .set(auth(user))
      .expect(204);
    await http()
      .delete(`${mySports}/${sports.Volleyball}`)
      .set(auth(user))
      .expect(404);

    const after = await http().get(mySports).set(auth(user)).expect(200);
    expect((after.body as UserSportBody[]).map((sport) => sport.name)).toEqual([
      'Running',
    ]);
    // Removing deletes only the UserSport row, never the sport.
    expect(
      await prisma.sport.count({
        where: { id: sports.Volleyball, isActive: true },
      }),
    ).toBe(1);

    // The profile shows the same rows (the /profiles/me/sports alias uses the same service).
    const profile = await http()
      .get('/api/v1/profiles/me')
      .set(auth(user))
      .expect(200);
    expect(
      (profile.body as { sports: UserSportBody[] }).sports.map(
        (sport) => sport.name,
      ),
    ).toEqual(['Running']);
  });

  it('rejects an inactive sport and a duplicate', async () => {
    const user = await register('rules');

    const inactive = await http()
      .post(mySports)
      .set(auth(user))
      .send({ sportId: retiredSportId, skillLevel: 'BEGINNER' })
      .expect(404);
    expect((inactive.body as ErrorBody).message).toBe('Sport not found.');

    await http()
      .post(mySports)
      .set(auth(user))
      .send({ sportId: sports.Tennis, skillLevel: 'BEGINNER' })
      .expect(201);
    const duplicate = await http()
      .post(mySports)
      .set(auth(user))
      .send({ sportId: sports.Tennis, skillLevel: 'PROFESSIONAL' })
      .expect(409);
    expect((duplicate.body as ErrorBody).message).toBe(
      'Tennis is already on your profile. Edit it instead.',
    );
    expect(await prisma.userSport.count({ where: { userId: user.id } })).toBe(
      1,
    );
  });

  it("cannot read, change, or remove another user's sports", async () => {
    const owner = await register('owner');
    const other = await register('other');

    await http()
      .post(mySports)
      .set(auth(owner))
      .send({
        sportId: sports.Basketball,
        skillLevel: 'BEGINNER',
        position: 'Center',
      })
      .expect(201);

    // The other user's "me" is themselves: the owner's row is simply not theirs.
    await http()
      .patch(`${mySports}/${sports.Basketball}`)
      .set(auth(other))
      .send({ skillLevel: 'PROFESSIONAL' })
      .expect(404);
    await http()
      .delete(`${mySports}/${sports.Basketball}`)
      .set(auth(other))
      .expect(404);
    const otherList = await http().get(mySports).set(auth(other)).expect(200);
    expect(otherList.body).toEqual([]);

    // A userId in the body is rejected, never trusted.
    await http()
      .post(mySports)
      .set(auth(other))
      .send({
        userId: owner.id,
        sportId: sports.Football,
        skillLevel: 'BEGINNER',
      })
      .expect(400);

    const ownerRows = await prisma.userSport.findMany({
      where: { userId: owner.id },
      select: { sportId: true, skillLevel: true, position: true },
    });
    expect(ownerRows).toEqual([
      {
        sportId: sports.Basketball,
        skillLevel: 'BEGINNER',
        position: 'Center',
      },
    ]);
    expect(await prisma.userSport.count({ where: { userId: other.id } })).toBe(
      0,
    );
  });

  it('rejects an invalid skill level and an invalid or missing sport id', async () => {
    const user = await register('invalid');
    const add = (body: Record<string, unknown>) =>
      http().post(mySports).set(auth(user)).send(body);

    const badLevel = await add({
      sportId: sports.Football,
      skillLevel: 'LEGEND',
    }).expect(400);
    expect((badLevel.body as ErrorBody).message).toContain(
      'Skill level must be one of',
    );
    await add({ sportId: sports.Football }).expect(400);

    const badId = await add({
      sportId: 'football',
      skillLevel: 'BEGINNER',
    }).expect(400);
    expect((badId.body as ErrorBody).message).toContain(
      'Choose a valid sport.',
    );
    await add({ skillLevel: 'BEGINNER' }).expect(400);
    await add({ sportId: UNKNOWN_UUID, skillLevel: 'BEGINNER' }).expect(404);
    await add({
      sportId: sports.Football,
      skillLevel: 'BEGINNER',
      position: 'x'.repeat(41),
    }).expect(400);

    await add({ sportId: sports.Football, skillLevel: 'BEGINNER' }).expect(201);
    await http()
      .patch(`${mySports}/${sports.Football}`)
      .set(auth(user))
      .send({ skillLevel: 'LEGEND' })
      .expect(400);
    await http()
      .patch(`${mySports}/not-a-uuid`)
      .set(auth(user))
      .send({ skillLevel: 'ADVANCED' })
      .expect(404);
    await http().delete(`${mySports}/not-a-uuid`).set(auth(user)).expect(404);

    const row = await prisma.userSport.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.skillLevel).toBe('BEGINNER');
  });
});
