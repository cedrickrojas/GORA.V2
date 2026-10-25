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
  username: string;
  token: string;
}

interface ClubBody {
  id: string;
  name: string;
  username: string;
  description: string | null;
  about: string | null;
  primarySport: { id: string; name: string } | null;
  additionalSports: { id: string; name: string }[];
  location: {
    country: string | null;
    city: string | null;
    barangay: string | null;
    homeCourt: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  maxMembers: number;
  currentMembers: number;
  availableSlots: number;
  isFull: boolean;
  membershipType: string;
  isPublic: boolean;
  rules: string[];
  tags: string[];
  schedule: { day: string | null; startTime: string | null };
  contact: { email: string | null; websiteUrl: string | null };
  owner: { id: string; username: string };
  viewer: {
    membership: { role: string; status: string } | null;
    hasInvite: boolean;
    canManageClub: boolean;
    canManageMembers: boolean;
    canChat: boolean;
  };
  contentVisible: boolean;
}

interface ErrorBody {
  message: string;
}

jest.setTimeout(120_000);

/** Real database, throwaway users and clubs; everything created here is removed afterwards. */
describe('Club creation and capacity (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const userIds: string[] = [];
  const clubIds: string[] = [];
  const users = {} as Record<
    | 'owner'
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'outsider'
    | 'invitee'
    | 'o1'
    | 'o2'
    | 'o3',
    TestUser
  >;
  let volleyballId: string;
  let basketballId: string;
  let mainClub: ClubBody;
  let capClub: ClubBody;

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });
  const clubUrl = (clubId: string, path = '') =>
    `/api/v1/clubs/${clubId}${path}`;

  async function register(name: string): Promise<TestUser> {
    const username = `e2e_cl_${name}_${suffix}`.toLowerCase();
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
    userIds.push(body.user.id);

    return { id: body.user.id, username, token: body.accessToken };
  }

  function clubPayload(overrides: Record<string, unknown> = {}) {
    return {
      name: 'Manila Volleyball Club',
      username: `e2e-mvc-${suffix}`,
      description: 'Weekend volleyball in Manila.',
      primarySportId: volleyballId,
      maxMembers: 50,
      membershipType: 'OPEN',
      isPublic: true,
      ...overrides,
    };
  }

  async function createClub(
    owner: TestUser,
    overrides: Record<string, unknown>,
  ): Promise<ClubBody> {
    const response = await http()
      .post('/api/v1/clubs')
      .set(auth(owner))
      .send(clubPayload(overrides))
      .expect(201);
    const club = response.body as ClubBody;
    clubIds.push(club.id);

    return club;
  }

  async function getClub(clubId: string, viewer: TestUser): Promise<ClubBody> {
    const response = await http()
      .get(clubUrl(clubId))
      .set(auth(viewer))
      .expect(200);
    return response.body as ClubBody;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    const sports = await prisma.sport.findMany({
      where: { name: { in: ['Volleyball', 'Basketball'] } },
      select: { id: true, name: true },
    });
    volleyballId = sports.find((sport) => sport.name === 'Volleyball')!.id;
    basketballId = sports.find((sport) => sport.name === 'Basketball')!.id;

    for (const name of Object.keys({
      owner: 1,
      a: 1,
      b: 1,
      c: 1,
      d: 1,
      e: 1,
      outsider: 1,
      invitee: 1,
      o1: 1,
      o2: 1,
      o3: 1,
    }) as (keyof typeof users)[]) {
      users[name] = await register(name);
    }
  });

  afterAll(async () => {
    const conversations = await prisma.conversation.findMany({
      where: { clubId: { in: clubIds } },
      select: { id: true },
    });
    const conversationIds = conversations.map(({ id }) => id);

    await prisma.message.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.conversation.deleteMany({
      where: { id: { in: conversationIds } },
    });
    await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('requires a signed-in user', async () => {
    await http().post('/api/v1/clubs').send(clubPayload()).expect(401);
    await http().get('/api/v1/clubs/mine').expect(401);
  });

  it('rejects a missing, zero, negative, decimal, text, or over-limit maximum', async () => {
    const cases: [unknown, string][] = [
      [undefined, 'Maximum members is required.'],
      [null, 'Maximum members is required.'],
      [0, 'Maximum members must be at least 1.'],
      [-5, 'Maximum members must be at least 1.'],
      [10.5, 'Maximum members must be a whole number.'],
      ['50', 'Maximum members must be a whole number.'],
      ['many', 'Maximum members must be a whole number.'],
      [1001, 'Maximum members cannot be more than 1000.'],
    ];

    for (const [maxMembers, message] of cases) {
      const response = await http()
        .post('/api/v1/clubs')
        .set(auth(users.owner))
        .send(clubPayload({ maxMembers }))
        .expect(400);
      expect((response.body as ErrorBody).message).toContain(message);
    }

    expect(
      await prisma.club.count({ where: { ownerId: users.owner.id } }),
    ).toBe(0);
  });

  it('validates the other creation fields on the server', async () => {
    const bad: [Record<string, unknown>, string][] = [
      [{ name: ' ' }, 'Club name must be at least 2 characters.'],
      [{ username: 'Bad Name!' }, 'Club username can use lowercase letters'],
      [{ username: 'ab' }, 'Club username must be at least 3 characters.'],
      [{ description: '' }, 'Add a short description.'],
      [{ primarySportId: 'basketball' }, 'Choose a primary sport.'],
      [{ membershipType: 'ANYONE' }, 'Who can join must be one of'],
      [
        { facebookUrl: 'https://evil.example/page' },
        'Facebook link must be an',
      ],
      [{ contactEmail: 'not-an-email' }, 'Contact email must be a valid'],
      [{ activityStartTime: '25:00' }, 'Start time must be a time like'],
      [{ tags: ['#'] }, 'Tags must be 2 to 30 letters or numbers.'],
      [{ rules: ['  '] }, 'Rules cannot be empty.'],
      [{ latitude: 14.6 }, 'Give both latitude and longitude, or neither.'],
      [
        { activityStartTime: '18:00', activityEndTime: '17:00' },
        'End time must be after the start time.',
      ],
      [{ ownerId: users.a.id }, 'property ownerId should not exist'],
      [{ currentMembers: 1 }, 'property currentMembers should not exist'],
    ];

    for (const [overrides, message] of bad) {
      const response = await http()
        .post('/api/v1/clubs')
        .set(auth(users.owner))
        .send(clubPayload(overrides))
        .expect(400);
      expect((response.body as ErrorBody).message).toContain(message);
    }
  });

  it('creates a club: owner is the first ACTIVE member (1 / 50) and exactly one club chat exists', async () => {
    mainClub = await createClub(users.owner, {
      username: ` @E2E-MVC-${suffix} `,
      about: 'We play every Saturday.',
      additionalSportIds: [basketballId, volleyballId, basketballId],
      country: 'Philippines',
      city: 'Manila',
      barangay: 'Malate',
      homeCourt: 'Rizal Memorial Court',
      latitude: 14.5636,
      longitude: 120.9917,
      rules: ['Be on time', 'Respect everyone'],
      tags: ['#Weekend Games', 'weekendgames', 'Beginners'],
      activityDay: 'SATURDAY',
      activityStartTime: '08:00',
      activityEndTime: '11:00',
      contactEmail: 'Club@Example.test',
      facebookUrl: 'https://www.facebook.com/manilavolley',
    });

    expect(mainClub).toMatchObject({
      name: 'Manila Volleyball Club',
      username: `e2e-mvc-${suffix}`,
      primarySport: { id: volleyballId, name: 'Volleyball' },
      additionalSports: [{ id: basketballId, name: 'Basketball' }],
      maxMembers: 50,
      currentMembers: 1,
      availableSlots: 49,
      isFull: false,
      membershipType: 'OPEN',
      isPublic: true,
      rules: ['Be on time', 'Respect everyone'],
      tags: ['beginners', 'weekendgames'],
      schedule: { day: 'SATURDAY', startTime: '08:00' },
      contact: { email: 'club@example.test' },
      owner: { id: users.owner.id },
      viewer: {
        membership: { role: 'OWNER', status: 'ACTIVE' },
        canManageClub: true,
        canManageMembers: true,
        canChat: true,
      },
    });
    const json = JSON.stringify(mainClub);
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain(`${users.owner.username}@example.test`);

    const [members, chats] = await Promise.all([
      prisma.clubMember.findMany({
        where: { clubId: mainClub.id },
        select: { userId: true, role: true, status: true },
      }),
      prisma.conversation.findMany({
        where: { clubId: mainClub.id },
        select: { type: true },
      }),
    ]);
    expect(members).toEqual([
      { userId: users.owner.id, role: 'OWNER', status: 'ACTIVE' },
    ]);
    expect(chats).toEqual([{ type: 'CLUB' }]);

    await http()
      .get(clubUrl(mainClub.id, '/chat'))
      .set(auth(users.owner))
      .expect(200);
  });

  it('refuses a club username that is already taken', async () => {
    const response = await http()
      .post('/api/v1/clubs')
      .set(auth(users.a))
      .send(clubPayload({ name: 'Copycat Club' }))
      .expect(409);
    expect((response.body as ErrorBody).message).toBe(
      'That club username is already taken.',
    );
  });

  it('offers no generic group chat creation', async () => {
    for (const path of [
      '/api/v1/conversations/group',
      '/api/v1/chat/groups',
      '/api/v1/conversations',
    ]) {
      await http()
        .post(path)
        .set(auth(users.owner))
        .send({ userIds: [users.a.id, users.b.id] })
        .expect(404);
    }

    expect(
      await prisma.conversation.count({
        where: { type: 'CLUB', clubId: null },
      }),
    ).toBe(0);
  });

  it('adds members to an OPEN club and updates the count', async () => {
    const joined = await http()
      .post(clubUrl(mainClub.id, '/join'))
      .set(auth(users.a))
      .expect(200);
    expect(joined.body).toMatchObject({
      status: 'JOINED',
      club: {
        currentMembers: 2,
        availableSlots: 48,
        viewer: { membership: { role: 'MEMBER', status: 'ACTIVE' } },
      },
    });

    await http()
      .post(clubUrl(mainClub.id, '/join'))
      .set(auth(users.a))
      .expect(409);
    expect((await getClub(mainClub.id, users.outsider)).currentMembers).toBe(2);
  });

  it('PENDING requests do not use capacity; the club becomes FULL at max and refuses more joins', async () => {
    capClub = await createClub(users.owner, {
      name: 'Tiny Approval Club',
      username: `e2e-tiny-${suffix}`,
      maxMembers: 3,
      membershipType: 'APPROVAL_REQUIRED',
    });

    for (const user of [users.a, users.b, users.c, users.d]) {
      const response = await http()
        .post(clubUrl(capClub.id, '/join'))
        .set(auth(user))
        .expect(200);
      expect((response.body as { status: string }).status).toBe('REQUESTED');
    }

    let club = await getClub(capClub.id, users.owner);
    expect(club).toMatchObject({
      currentMembers: 1,
      availableSlots: 2,
      isFull: false,
    });

    const requests = await http()
      .get(clubUrl(capClub.id, '/members/requests'))
      .set(auth(users.owner))
      .expect(200);
    expect((requests.body as unknown[]).length).toBe(4);

    await http()
      .post(clubUrl(capClub.id, `/members/${users.a.id}/approve`))
      .set(auth(users.owner))
      .expect(200);
    expect((await getClub(capClub.id, users.owner)).currentMembers).toBe(2);

    const results = await Promise.all(
      [users.b, users.c, users.d].map((user) =>
        http()
          .post(clubUrl(capClub.id, `/members/${user.id}/approve`))
          .set(auth(users.owner)),
      ),
    );
    const statuses = results.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409]);
    for (const response of results.filter((r) => r.status === 409)) {
      expect((response.body as ErrorBody).message).toBe(
        'Club is currently full.',
      );
    }

    club = await getClub(capClub.id, users.owner);
    expect(club).toMatchObject({
      maxMembers: 3,
      currentMembers: 3,
      availableSlots: 0,
      isFull: true,
    });
    expect(
      await prisma.clubMember.count({
        where: { clubId: capClub.id, status: 'ACTIVE' },
      }),
    ).toBe(3);

    const extra = await http()
      .post(clubUrl(capClub.id, '/join'))
      .set(auth(users.e))
      .expect(409);
    expect((extra.body as ErrorBody).message).toBe('Club is currently full.');
  });

  it('concurrent joins to an OPEN club never overflow it', async () => {
    const openClub = await createClub(users.owner, {
      name: 'Race Club',
      username: `e2e-race-${suffix}`,
      maxMembers: 2,
    });

    const results = await Promise.all(
      [users.o1, users.o2, users.o3].map((user) =>
        http().post(clubUrl(openClub.id, '/join')).set(auth(user)),
      ),
    );

    expect(results.map((response) => response.status).sort()).toEqual([
      200, 409, 409,
    ]);
    expect(
      await prisma.clubMember.count({
        where: { clubId: openClub.id, status: 'ACTIVE' },
      }),
    ).toBe(2);
  });

  it('the database refuses an activation past capacity even without the API', async () => {
    const pending = await prisma.clubMember.findFirstOrThrow({
      where: { clubId: capClub.id, status: 'PENDING' },
      select: { userId: true },
    });

    await expect(
      prisma.clubMember.update({
        where: {
          clubId_userId: { clubId: capClub.id, userId: pending.userId },
        },
        data: { status: 'ACTIVE' },
      }),
    ).rejects.toThrow(/Club is currently full/);
    await expect(
      prisma.club.update({
        where: { id: capClub.id },
        data: { maxMembers: 2 },
      }),
    ).rejects.toThrow(/lower than the current active members/);
    expect(
      await prisma.clubMember.count({
        where: { clubId: capClub.id, status: 'ACTIVE' },
      }),
    ).toBe(3);
  });

  it('capacity can grow from 50 to 100, but not drop below the active members', async () => {
    const fillers = Array.from({ length: 38 }, (_, index) => ({
      username: `e2e_cl_fill${index}_${suffix}`,
      email: `e2e_cl_fill${index}_${suffix}@example.test`,
      passwordHash: 'e2e-placeholder-no-login',
      firstName: 'Filler',
      lastName: String(index),
    }));
    await prisma.user.createMany({ data: fillers });
    const fillerRows = await prisma.user.findMany({
      where: { username: { in: fillers.map((filler) => filler.username) } },
      select: { id: true },
    });
    userIds.push(...fillerRows.map(({ id }) => id));
    await prisma.clubMember.createMany({
      data: fillerRows.map(({ id }) => ({
        clubId: mainClub.id,
        userId: id,
        status: 'ACTIVE' as const,
      })),
    });
    expect((await getClub(mainClub.id, users.owner)).currentMembers).toBe(40);

    const grown = await http()
      .patch(clubUrl(mainClub.id))
      .set(auth(users.owner))
      .send({ maxMembers: 100 })
      .expect(200);
    expect(grown.body).toMatchObject({
      maxMembers: 100,
      currentMembers: 40,
      availableSlots: 60,
    });

    const shrunk = await http()
      .patch(clubUrl(mainClub.id))
      .set(auth(users.owner))
      .send({ maxMembers: 20 })
      .expect(409);
    expect((shrunk.body as ErrorBody).message).toBe(
      'Maximum members cannot be lower than the current 40 active members.',
    );
    expect((await getClub(mainClub.id, users.owner)).maxMembers).toBe(100);
    expect(
      await prisma.clubMember.count({
        where: { clubId: mainClub.id, status: 'ACTIVE' },
      }),
    ).toBe(40);

    await http()
      .patch(clubUrl(mainClub.id))
      .set(auth(users.owner))
      .send({ maxMembers: 0 })
      .expect(400);
  });

  it('only the owner changes club settings', async () => {
    await http()
      .patch(clubUrl(mainClub.id))
      .set(auth(users.a))
      .send({ maxMembers: 500 })
      .expect(403);
    await http()
      .patch(clubUrl(mainClub.id))
      .set(auth(users.outsider))
      .send({ name: 'Hijacked' })
      .expect(403);
    await http()
      .get(clubUrl(capClub.id, '/members/requests'))
      .set(auth(users.a))
      .expect(403);

    const updated = await http()
      .patch(clubUrl(mainClub.id))
      .set(auth(users.owner))
      .send({
        description: 'Updated description.',
        tags: ['Spikers'],
        rules: ['New rule'],
        about: null,
      })
      .expect(200);
    expect(updated.body).toMatchObject({
      description: 'Updated description.',
      tags: ['spikers'],
      rules: ['New rule'],
      about: null,
    });
  });

  it('club chat follows ACTIVE membership; removing a member frees a slot', async () => {
    await http()
      .get(clubUrl(capClub.id, '/chat'))
      .set(auth(users.a))
      .expect(200);
    await http()
      .post(clubUrl(capClub.id, '/chat/messages'))
      .set(auth(users.a))
      .send({ content: 'Hello team' })
      .expect(201);

    const pendingUser = await prisma.clubMember.findFirstOrThrow({
      where: { clubId: capClub.id, status: 'PENDING' },
      select: { userId: true },
    });
    const pending = Object.values(users).find(
      (user) => user.id === pendingUser.userId,
    )!;
    await http()
      .get(clubUrl(capClub.id, '/chat'))
      .set(auth(pending))
      .expect(403);
    await http()
      .get(clubUrl(capClub.id, '/chat'))
      .set(auth(users.outsider))
      .expect(403);

    await http()
      .post(clubUrl(capClub.id, `/members/${users.a.id}/remove`))
      .set(auth(users.owner))
      .expect(200);

    const club = await getClub(capClub.id, users.owner);
    expect(club).toMatchObject({
      currentMembers: 2,
      availableSlots: 1,
      isFull: false,
    });
    await http()
      .get(clubUrl(capClub.id, '/chat'))
      .set(auth(users.a))
      .expect(403);
    await http()
      .post(clubUrl(capClub.id, '/chat/messages'))
      .set(auth(users.a))
      .send({ content: 'Still here?' })
      .expect(403);

    await http()
      .post(clubUrl(capClub.id, `/members/${pending.id}/approve`))
      .set(auth(users.owner))
      .expect(200);
    await http()
      .get(clubUrl(capClub.id, '/chat'))
      .set(auth(pending))
      .expect(200);
    expect((await getClub(capClub.id, users.owner)).isFull).toBe(true);
  });

  it('leaving frees a slot; the owner cannot leave', async () => {
    await http()
      .post(clubUrl(mainClub.id, '/leave'))
      .set(auth(users.a))
      .expect(200);
    expect((await getClub(mainClub.id, users.owner)).currentMembers).toBe(39);
    await http()
      .post(clubUrl(mainClub.id, '/leave'))
      .set(auth(users.owner))
      .expect(409);
  });

  it('INVITE_ONLY clubs need an invitation that the backend verifies', async () => {
    const inviteClub = await createClub(users.owner, {
      name: 'Invite Club',
      username: `e2e-invite-${suffix}`,
      maxMembers: 10,
      membershipType: 'INVITE_ONLY',
    });

    const denied = await http()
      .post(clubUrl(inviteClub.id, '/join'))
      .set(auth(users.invitee))
      .expect(403);
    expect((denied.body as ErrorBody).message).toBe(
      'This club is invite only. You need an invitation to join.',
    );

    await http()
      .post(clubUrl(inviteClub.id, '/invites'))
      .set(auth(users.outsider))
      .send({ username: users.invitee.username })
      .expect(403);
    await http()
      .post(clubUrl(inviteClub.id, '/invites'))
      .set(auth(users.owner))
      .send({ username: `@${users.invitee.username}` })
      .expect(201);

    expect((await getClub(inviteClub.id, users.invitee)).viewer.hasInvite).toBe(
      true,
    );
    const joined = await http()
      .post(clubUrl(inviteClub.id, '/join'))
      .set(auth(users.invitee))
      .expect(200);
    expect(joined.body).toMatchObject({
      status: 'JOINED',
      club: { currentMembers: 2 },
    });
    expect(
      await prisma.clubInvite.findFirst({
        where: { clubId: inviteClub.id, inviteeId: users.invitee.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'ACCEPTED' });

    await http()
      .post(clubUrl(inviteClub.id, '/join'))
      .set(auth(users.outsider))
      .expect(403);
  });

  it('private clubs hide their details and members from non-members', async () => {
    const privateClub = await createClub(users.owner, {
      name: 'Secret Club',
      username: `e2e-secret-${suffix}`,
      isPublic: false,
      membershipType: 'APPROVAL_REQUIRED',
      about: 'Members only',
      barangay: 'Hidden',
      rules: ['Keep it private'],
      contactEmail: 'secret@example.test',
      websiteUrl: 'https://example.test',
    });

    const outsiderView = await getClub(privateClub.id, users.outsider);
    expect(outsiderView).toMatchObject({
      name: 'Secret Club',
      contentVisible: false,
      about: null,
      rules: [],
      location: { barangay: null },
      contact: { email: null, websiteUrl: null },
      currentMembers: 1,
    });
    await http()
      .get(clubUrl(privateClub.id, '/members'))
      .set(auth(users.outsider))
      .expect(403);

    const ownerView = await getClub(privateClub.id, users.owner);
    expect(ownerView).toMatchObject({
      contentVisible: true,
      about: 'Members only',
      rules: ['Keep it private'],
      contact: { email: 'secret@example.test' },
    });

    const publicMember = await getClub(mainClub.id, users.outsider);
    expect(publicMember.contact.email).toBeNull();
  });

  it('My Clubs lists the clubs with current / max members; the club profile shows them too', async () => {
    const mine = await http()
      .get('/api/v1/clubs/mine')
      .set(auth(users.owner))
      .expect(200);
    const ids = (mine.body as ClubBody[]).map((club) => club.id);
    expect(ids).toEqual(expect.arrayContaining([mainClub.id, capClub.id]));
    const listed = (mine.body as ClubBody[]).find(
      (club) => club.id === mainClub.id,
    )!;
    expect(listed).toMatchObject({ currentMembers: 39, maxMembers: 100 });

    const profile = await getClub(capClub.id, users.outsider);
    expect(profile).toMatchObject({
      currentMembers: 3,
      maxMembers: 3,
      isFull: true,
      viewer: { membership: null, canChat: false, canManageClub: false },
    });

    await http()
      .get(clubUrl('00000000-0000-4000-8000-000000000000'))
      .set(auth(users.owner))
      .expect(404);
    await http().get(clubUrl('not-a-uuid')).set(auth(users.owner)).expect(404);
  });
});
