import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap/configure-app';
import { PrismaService } from './../src/prisma/prisma.service';
import { toPairKey } from './../src/social/relationship';

interface TestUser {
  id: string;
  username: string;
  token: string;
}

interface SportBody {
  sportId: string;
  name: string;
  skillLevel: string;
  position: string | null;
}

interface ProfileBody {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  profileImageUrl: string | null;
  bio: string | null;
  city: string | null;
  dateOfBirth?: string | null;
  isOwnProfile: boolean;
  sports: SportBody[];
  stats: { friends: number; followers: number; following: number } | null;
  sections: Record<string, number> | null;
  relationship?: { state: string; messageAccess: string };
}

const SENSITIVE_KEYS = ['passwordHash', 'email', 'role', 'isActive'];

/** Real database, throwaway users; everything created here is removed afterwards. */
describe('Profiles and sports profiles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const created: string[] = [];
  let sports: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_prof_${name}_${suffix}`;
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
    created.push(body.user.id);

    return { id: body.user.id, username, token: body.accessToken };
  }

  function expectNoSensitiveFields(body: unknown): void {
    const text = JSON.stringify(body);

    for (const key of SENSITIVE_KEYS) {
      expect(text).not.toContain(`"${key}"`);
    }
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await app.close();
  });

  it('requires a signed-in user for every profile and sports route', async () => {
    await http().get('/api/v1/profiles/me').expect(401);
    await http().patch('/api/v1/profiles/me').send({ bio: 'x' }).expect(401);
    await http().get('/api/v1/profiles/me/sports').expect(401);
    await http().post('/api/v1/profiles/me/sports').send({}).expect(401);
    await http().get('/api/v1/profiles/anyone').expect(401);
    await http().get('/api/v1/sports').expect(401);
    await http()
      .get('/api/v1/profiles/me')
      .set({ Authorization: 'Bearer not-a-real-token' })
      .expect(401);
  });

  it('runs the full profile and sports flow for one user and keeps others read-only', async () => {
    const a = await register('a');

    const sportsResponse = await http()
      .get('/api/v1/sports')
      .set(auth(a))
      .expect(200);
    const sportList = sportsResponse.body as { id: string; name: string }[];
    sports = Object.fromEntries(
      sportList.map((sport) => [sport.name, sport.id]),
    );
    expect(sportList.map((sport) => sport.name)).toEqual([
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
    ]);

    const me = await http().get('/api/v1/profiles/me').set(auth(a)).expect(200);
    const initial = me.body as ProfileBody;
    expectNoSensitiveFields(initial);
    expect(initial).toMatchObject({
      id: a.id,
      username: a.username,
      displayName: 'E2E a',
      isOwnProfile: true,
      sports: [],
      stats: { friends: 0, followers: 0, following: 0 },
      sections: {
        posts: 0,
        games: 0,
        reels: 0,
        stories: 0,
        clubs: 0,
        activity: 0,
        badges: 0,
      },
    });

    const updated = await http()
      .patch('/api/v1/profiles/me')
      .set(auth(a))
      .send({
        firstName: '  Louis ',
        lastName: 'Tabernero',
        bio: 'Point guard. Weekend runs.',
        city: 'Quezon City',
        dateOfBirth: '2000-05-17',
        profileImageUrl: 'https://cdn.example.com/avatars/louis.jpg',
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      firstName: 'Louis',
      displayName: 'Louis Tabernero',
      bio: 'Point guard. Weekend runs.',
      city: 'Quezon City',
      dateOfBirth: '2000-05-17',
      profileImageUrl: 'https://cdn.example.com/avatars/louis.jpg',
    });

    const cleared = await http()
      .patch('/api/v1/profiles/me')
      .set(auth(a))
      .send({ city: '   ', profileImageUrl: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      city: null,
      profileImageUrl: null,
      bio: 'Point guard. Weekend runs.',
    });

    const added = await http()
      .post('/api/v1/profiles/me/sports')
      .set(auth(a))
      .send({
        sportId: sports.Basketball,
        skillLevel: 'ADVANCED',
        position: 'Point Guard',
      })
      .expect(201);
    expect(added.body).toMatchObject({
      sportId: sports.Basketball,
      name: 'Basketball',
      skillLevel: 'ADVANCED',
      position: 'Point Guard',
    });

    await http()
      .post('/api/v1/profiles/me/sports')
      .set(auth(a))
      .send({ sportId: sports.Running, skillLevel: 'BEGINNER' })
      .expect(201);

    const listed = await http()
      .get('/api/v1/profiles/me/sports')
      .set(auth(a))
      .expect(200);
    expect(
      (listed.body as SportBody[]).map((sport) => [sport.name, sport.position]),
    ).toEqual([
      ['Basketball', 'Point Guard'],
      ['Running', null],
    ]);

    const levelUp = await http()
      .patch(`/api/v1/profiles/me/sports/${sports.Basketball}`)
      .set(auth(a))
      .send({ skillLevel: 'PROFESSIONAL' })
      .expect(200);
    expect(levelUp.body).toMatchObject({
      skillLevel: 'PROFESSIONAL',
      position: 'Point Guard',
    });

    const noPosition = await http()
      .patch(`/api/v1/profiles/me/sports/${sports.Basketball}`)
      .set(auth(a))
      .send({ position: '' })
      .expect(200);
    expect((noPosition.body as SportBody).position).toBeNull();

    await http()
      .delete(`/api/v1/profiles/me/sports/${sports.Basketball}`)
      .set(auth(a))
      .expect(204);
    await http()
      .delete(`/api/v1/profiles/me/sports/${sports.Basketball}`)
      .set(auth(a))
      .expect(404);

    const b = await register('b');
    const viewed = await http()
      .get(`/api/v1/profiles/${b.username.toUpperCase()}`)
      .set(auth(a))
      .expect(200);
    const bProfile = viewed.body as ProfileBody;
    expectNoSensitiveFields(bProfile);
    expect(bProfile).toMatchObject({
      id: b.id,
      isOwnProfile: false,
      relationship: { state: 'NO_RELATIONSHIP', messageAccess: 'REQUEST' },
    });
    expect(bProfile).not.toHaveProperty('dateOfBirth');

    // A's own username through the public route returns A's own profile.
    const self = await http()
      .get(`/api/v1/profiles/${a.username}`)
      .set(auth(a))
      .expect(200);
    expect((self.body as ProfileBody).isOwnProfile).toBe(true);

    // There is no route that writes someone else's profile or sports.
    await http()
      .patch(`/api/v1/profiles/${b.username}`)
      .set(auth(a))
      .send({ bio: 'hacked' })
      .expect(404);
    await http()
      .patch('/api/v1/profiles/me')
      .set(auth(a))
      .send({ id: b.id, bio: 'hacked' })
      .expect(400);

    const bAfter = await http()
      .get('/api/v1/profiles/me')
      .set(auth(b))
      .expect(200);
    expect((bAfter.body as ProfileBody).bio).toBeNull();

    await http()
      .post('/api/v1/profiles/me/sports')
      .set(auth(b))
      .send({ sportId: sports.Tennis, skillLevel: 'INTERMEDIATE' })
      .expect(201);
    await http()
      .patch(`/api/v1/profiles/me/sports/${sports.Tennis}`)
      .set(auth(a))
      .send({ skillLevel: 'BEGINNER' })
      .expect(404);
    await http()
      .delete(`/api/v1/profiles/me/sports/${sports.Tennis}`)
      .set(auth(a))
      .expect(404);

    const bSports = await http()
      .get(`/api/v1/profiles/${b.username}`)
      .set(auth(a))
      .expect(200);
    expect((bSports.body as ProfileBody).sports).toMatchObject([
      { name: 'Tennis', skillLevel: 'INTERMEDIATE' },
    ]);
  });

  it('rejects invalid profile updates with readable messages', async () => {
    const user = await register('invalid');
    const bad: [Record<string, unknown>, string][] = [
      [{ username: 'someone_else' }, 'Username cannot be changed'],
      [{ email: 'new@example.test' }, 'Email cannot be changed'],
      [{ role: 'ADMIN' }, 'role should not exist'],
      [{ passwordHash: 'x' }, 'passwordHash should not exist'],
      [{ isActive: false }, 'isActive should not exist'],
      [{ createdAt: '2020-01-01' }, 'createdAt should not exist'],
      [{ firstName: '' }, 'First name cannot be empty'],
      [{ firstName: null }, 'First name must be text'],
      [{ lastName: 'x'.repeat(51) }, 'Last name must be at most 50'],
      [{ bio: 'x'.repeat(161) }, 'Bio must be at most 160'],
      [{ city: 'x'.repeat(101) }, 'City must be at most 100'],
      [
        { dateOfBirth: '2999-01-01' },
        'Date of birth must be a valid past date',
      ],
      [
        { dateOfBirth: '2001-02-30' },
        'Date of birth must be a valid past date',
      ],
      [{ profileImageUrl: 'not a url' }, 'Profile photo must be a valid'],
      [
        { profileImageUrl: 'javascript:alert(1)' },
        'Profile photo must be a valid',
      ],
      [
        { coverImageUrl: 'ftp://example.com/c.jpg' },
        'Cover photo must be a valid',
      ],
    ];

    for (const [body, message] of bad) {
      const response = await http()
        .patch('/api/v1/profiles/me')
        .set(auth(user))
        .send(body)
        .expect(400);
      expect((response.body as { message: string }).message).toContain(message);
    }

    const unchanged = await http()
      .get('/api/v1/profiles/me')
      .set(auth(user))
      .expect(200);
    expect(unchanged.body).toMatchObject({
      firstName: 'E2E',
      username: user.username,
    });
  });

  it('validates sports: duplicate, invalid level, missing or retired sport, long position', async () => {
    const user = await register('sports');
    const add = (body: Record<string, unknown>) =>
      http().post('/api/v1/profiles/me/sports').set(auth(user)).send(body);

    await add({
      sportId: sports.Volleyball,
      skillLevel: 'BEGINNER',
      position: 'Setter',
    }).expect(201);

    const duplicate = await add({
      sportId: sports.Volleyball,
      skillLevel: 'ADVANCED',
    }).expect(409);
    expect((duplicate.body as { message: string }).message).toBe(
      'Volleyball is already on your profile. Edit it instead.',
    );

    const badLevel = await add({
      sportId: sports.Football,
      skillLevel: 'LEGEND',
    }).expect(400);
    expect((badLevel.body as { message: string }).message).toContain(
      'Skill level must be one of',
    );

    const missing = await add({
      sportId: '00000000-0000-4000-8000-000000000000',
      skillLevel: 'BEGINNER',
    }).expect(404);
    expect((missing.body as { message: string }).message).toBe(
      'Sport not found.',
    );

    await add({ sportId: 'basketball', skillLevel: 'BEGINNER' }).expect(400);
    await add({
      sportId: sports.Football,
      skillLevel: 'BEGINNER',
      position: 'x'.repeat(41),
    }).expect(400);
    await add({
      sportId: sports.Football,
      skillLevel: 'BEGINNER',
      extra: true,
    }).expect(400);

    await http()
      .patch(`/api/v1/profiles/me/sports/${sports.Volleyball}`)
      .set(auth(user))
      .send({ skillLevel: null })
      .expect(400);
    await http()
      .patch('/api/v1/profiles/me/sports/not-a-uuid')
      .set(auth(user))
      .send({ skillLevel: 'ADVANCED' })
      .expect(404);

    // A retired sport cannot be added and drops off the profile. A throwaway sport stands
    // in for it so the real sports are never touched.
    await http()
      .delete(`/api/v1/profiles/me/sports/${sports.Volleyball}`)
      .set(auth(user))
      .expect(204);
    // Created inactive so it never shows up in another suite's sport list.
    const retired = await prisma.sport.create({
      data: { name: `E2E Retired ${suffix}`, isActive: false },
      select: { id: true },
    });
    try {
      await add({ sportId: retired.id, skillLevel: 'BEGINNER' }).expect(404);
      await prisma.userSport.create({
        data: { userId: user.id, sportId: retired.id },
      });
      const listed = await http()
        .get('/api/v1/profiles/me/sports')
        .set(auth(user))
        .expect(200);
      expect(listed.body).toEqual([]);
    } finally {
      await prisma.userSport.deleteMany({ where: { sportId: retired.id } });
      await prisma.sport.delete({ where: { id: retired.id } });
    }
  });

  it('counts only accepted friends and real follows, and hides profiles across blocks', async () => {
    const owner = await register('owner');
    const friend = await register('friend');
    const pending = await register('pending');
    const fan = await register('fan');
    const blocker = await register('blocker');
    const blocked = await register('blocked');

    const friendship = (
      requester: TestUser,
      receiver: TestUser,
      status: 'ACCEPTED' | 'PENDING' | 'BLOCKED',
      blockedBy?: TestUser,
    ) =>
      prisma.friendship.create({
        data: {
          requesterId: requester.id,
          receiverId: receiver.id,
          pairKey: toPairKey(requester.id, receiver.id),
          status,
          blockedById: blockedBy?.id ?? null,
        },
      });

    await friendship(owner, friend, 'ACCEPTED');
    await friendship(pending, owner, 'PENDING');
    await friendship(blocker, owner, 'BLOCKED', blocker);
    await friendship(owner, blocked, 'BLOCKED', owner);
    await prisma.userFollow.createMany({
      data: [
        { followerId: fan.id, followingId: owner.id },
        { followerId: friend.id, followingId: owner.id },
        { followerId: owner.id, followingId: fan.id },
      ],
    });
    await http()
      .post('/api/v1/posts')
      .set(auth(owner))
      .send({ caption: 'friends only', visibility: 'FRIENDS' })
      .expect(201);

    const own = await http()
      .get('/api/v1/profiles/me')
      .set(auth(owner))
      .expect(200);
    expect(own.body).toMatchObject({
      stats: { friends: 1, followers: 2, following: 1 },
      sections: { posts: 1 },
    });

    const asFriend = await http()
      .get(`/api/v1/profiles/${owner.username}`)
      .set(auth(friend))
      .expect(200);
    expect(asFriend.body).toMatchObject({
      relationship: { state: 'FRIENDS', messageAccess: 'DIRECT' },
      sections: { posts: 1 },
    });

    const asFan = await http()
      .get(`/api/v1/profiles/${owner.username}`)
      .set(auth(fan))
      .expect(200);
    expect(asFan.body).toMatchObject({ sections: { posts: 0 } });

    const asRequester = await http()
      .get(`/api/v1/profiles/${owner.username}`)
      .set(auth(pending))
      .expect(200);
    expect((asRequester.body as ProfileBody).relationship?.state).toBe(
      'REQUEST_SENT',
    );

    // The owner blocked this user: they get the same 404 as for a missing account.
    await http()
      .get(`/api/v1/profiles/${owner.username}`)
      .set(auth(blocked))
      .expect(404);
    await http()
      .get(`/api/v1/profiles/e2e_nobody_${suffix}`)
      .set(auth(owner))
      .expect(404);

    // The owner sees who they blocked, with identity only, so they can unblock.
    const blockedView = await http()
      .get(`/api/v1/profiles/${blocked.username}`)
      .set(auth(owner))
      .expect(200);
    expect(blockedView.body).toMatchObject({
      relationship: { state: 'BLOCKED', messageAccess: 'NONE' },
      bio: null,
      sports: [],
      stats: null,
      sections: null,
    });

    // A deactivated account disappears and stops counting.
    await prisma.user.update({
      where: { id: fan.id },
      data: { isActive: false },
    });
    await http()
      .get(`/api/v1/profiles/${fan.username}`)
      .set(auth(owner))
      .expect(404);
    const afterDeactivation = await http()
      .get('/api/v1/profiles/me')
      .set(auth(owner))
      .expect(200);
    expect((afterDeactivation.body as ProfileBody).stats).toEqual({
      friends: 1,
      followers: 1,
      following: 0,
    });

    await prisma.post.deleteMany({ where: { userId: owner.id } });
  });

  it('enforces profile rules in the database too', async () => {
    const user = await register('db');

    await expect(
      prisma.user.update({
        where: { id: user.id },
        data: { firstName: '   ' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.user.update({
        where: { id: user.id },
        data: { profileImageUrl: 'data:image/png;base64,AAAA' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.userSport.create({
        data: { userId: user.id, sportId: sports.Cycling, position: ' ' },
      }),
    ).rejects.toThrow();

    await prisma.userSport.create({
      data: { userId: user.id, sportId: sports.Cycling },
    });
    await expect(
      prisma.userSport.create({
        data: { userId: user.id, sportId: sports.Cycling },
      }),
    ).rejects.toThrow();
  });

  it('reserves usernames that collide with profile routes', async () => {
    const response = await http()
      .post('/api/v1/auth/register')
      .send({
        username: 'edit',
        email: `reserved_${suffix}@example.test`,
        password: `Pw-${randomBytes(12).toString('hex')}`,
        firstName: 'Re',
        lastName: 'Served',
      })
      .expect(400);
    expect((response.body as { message: string }).message).toContain(
      'reserved',
    );
  });
});
