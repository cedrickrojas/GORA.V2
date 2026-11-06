import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { GoraPointsService } from '../src/gora-points/gora-points.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Club acceptance GORA points (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sportId: string;
  const suffix = randomBytes(4).toString('hex');
  const users: Record<string, { id: string; username: string; token: string }> =
    {};
  const clubs: string[] = [];
  const http = () => request(app.getHttpServer());
  const post = (who: string, path: string) =>
    http()
      .post(`/api/v1/clubs/${path}`)
      .auth(users[who].token, { type: 'bearer' });
  const balance = async (who: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id: users[who].id } }))
      .goraPoints;
  const events = (who: string, clubId: string) =>
    prisma.goraPointEvent.count({
      where: {
        userId: users[who].id,
        reason: 'CLUB_ACCEPTED',
        sourceKey: clubId,
      },
    });

  async function createClub(
    type: 'OPEN' | 'APPROVAL_REQUIRED' | 'INVITE_ONLY',
    maxMembers = 10,
  ): Promise<string> {
    const result = await http()
      .post('/api/v1/clubs')
      .auth(users.owner.token, { type: 'bearer' })
      .send({
        name: 'Club Points Verification',
        username: `points-${suffix}-${clubs.length}`,
        description: 'Temporary club acceptance test.',
        primarySportId: sportId,
        maxMembers,
        membershipType: type,
        isPublic: true,
      })
      .expect(201);
    clubs.push(result.body.id);
    return result.body.id;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    sportId = (
      await prisma.sport.findFirstOrThrow({ where: { isActive: true } })
    ).id;
    for (const name of ['owner', 'member', 'outsider', 'invitee', 'rollback']) {
      const username = `club_pts_${name}_${suffix}`;
      const user = await prisma.user.create({
        data: {
          username,
          email: `${username}@example.test`,
          passwordHash: 'unusable-test-fixture',
          firstName: 'Club',
          lastName: name,
        },
      });
      users[name] = {
        ...user,
        token: app.get(JwtService).sign({ sub: user.id }),
      };
    }
  }, 60000);

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      await prisma.conversation.deleteMany({
        where: { clubId: { in: clubs } },
      });
      await prisma.club.deleteMany({ where: { id: { in: clubs } } });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(users).map((user) => user.id) } },
      });
    }
    if (app) await app.close();
  });

  it('does not reward owners, pending, unauthorized, rejected or cancelled requests', async () => {
    const club = await createClub('APPROVAL_REQUIRED');
    expect(await balance('owner')).toBe(0);
    await post('member', `${club}/join`).expect(200);
    expect(await balance('member')).toBe(0);
    await post('outsider', `${club}/members/${users.member.id}/approve`).expect(
      403,
    );
    await post('member', `${club}/members/${users.member.id}/approve`).expect(
      403,
    );
    await post('owner', `${club}/members/${users.member.id}/reject`).expect(
      200,
    );
    expect(await events('member', club)).toBe(0);
    await post('member', `${club}/join`).expect(200);
    await post('member', `${club}/leave`).expect(200);
    expect(await balance('member')).toBe(0);
  });

  it('awards the accepted member exactly once under concurrent approvals and retries', async () => {
    const club = await createClub('APPROVAL_REQUIRED');
    await post('member', `${club}/join`).expect(200);
    const responses = await Promise.all([
      post('owner', `${club}/members/${users.member.id}/approve`),
      post('owner', `${club}/members/${users.member.id}/approve`),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 404,
    ]);
    expect(await balance('member')).toBe(1);
    expect(await balance('owner')).toBe(0);
    expect(await events('member', club)).toBe(1);
    await post('owner', `${club}/members/${users.member.id}/approve`).expect(
      404,
    );
    const profile = await http()
      .get('/api/v1/profiles/me')
      .auth(users.member.token, { type: 'bearer' })
      .expect(200);
    expect(profile.body.goraPoints).toBe(1);
    const ranking = await http()
      .get('/api/v1/gora-points/ranking')
      .auth(users.member.token, { type: 'bearer' })
      .expect(200);
    expect(ranking.body.currentPlayer.goraPoints).toBe(1);
    await post('member', `${club}/leave`).expect(200);
    await post('member', `${club}/join`).expect(200);
    await post('owner', `${club}/members/${users.member.id}/approve`).expect(
      200,
    );
    expect(await balance('member')).toBe(1);
    expect(await events('member', club)).toBe(1);
    await post('owner', `${club}/members/${users.member.id}/remove`).expect(
      200,
    );
    await post('member', `${club}/join`).expect(200);
    await post('owner', `${club}/members/${users.member.id}/approve`).expect(
      200,
    );
    expect(await balance('member')).toBe(1);
  });

  it('awards once in each different club, including open-club acceptance', async () => {
    const before = await balance('member');
    for (let index = 0; index < 2; index++) {
      const club = await createClub('OPEN');
      await post('member', `${club}/join`).expect(200);
      await post('member', `${club}/join`).expect(409);
      await post('member', `${club}/leave`).expect(200);
      await post('member', `${club}/join`).expect(200);
      expect(await events('member', club)).toBe(1);
    }
    expect(await balance('member')).toBe(before + 2);
  });

  it('rewards accepting an invitation, not sending it or a forbidden join', async () => {
    const club = await createClub('INVITE_ONLY');
    await post('invitee', `${club}/join`).expect(403);
    await post('owner', `${club}/invites`)
      .send({ username: users.invitee.username })
      .expect(201);
    expect(await balance('invitee')).toBe(0);
    await post('invitee', `${club}/join`).expect(200);
    expect(await balance('invitee')).toBe(1);
    expect(await events('invitee', club)).toBe(1);
  });

  it('does not award when capacity prevents acceptance', async () => {
    const club = await createClub('APPROVAL_REQUIRED', 2);
    const before = await balance('member');
    await post('member', `${club}/join`).expect(200);
    await post('invitee', `${club}/join`).expect(200);
    await post('owner', `${club}/members/${users.invitee.id}/approve`).expect(
      200,
    );
    await post('owner', `${club}/members/${users.member.id}/approve`).expect(
      409,
    );
    expect(await balance('member')).toBe(before);
    expect(await events('member', club)).toBe(0);
  });

  it('rolls membership back if the points write fails, then allows a safe retry', async () => {
    const club = await createClub('APPROVAL_REQUIRED');
    await post('rollback', `${club}/join`).expect(200);
    const award = jest
      .spyOn(app.get(GoraPointsService), 'awardInTransaction')
      .mockRejectedValueOnce(new Error('Simulated points failure'));
    try {
      await post(
        'owner',
        `${club}/members/${users.rollback.id}/approve`,
      ).expect(500);
    } finally {
      award.mockRestore();
    }
    const membership = await prisma.clubMember.findUniqueOrThrow({
      where: { clubId_userId: { clubId: club, userId: users.rollback.id } },
    });
    expect(membership.status).toBe('PENDING');
    expect(await balance('rollback')).toBe(0);
    expect(await events('rollback', club)).toBe(0);
    await post('owner', `${club}/members/${users.rollback.id}/approve`).expect(
      200,
    );
    expect(await balance('rollback')).toBe(1);
    expect(await events('rollback', club)).toBe(1);
  });
});
