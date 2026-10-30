import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

/** Run against a migrated test database. Only this suite's fixtures are removed. */
describe('Super admin with PostgreSQL (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let ownerId: string;
  let secondId: string;
  let userId: string;
  let reportId: string;
  let sportId: string;
  const suffix = randomBytes(5).toString('hex');
  const ids: string[] = [];
  const http = () => request(app.getHttpServer());
  const auth = (id: string) => ({
    Authorization: `Bearer ${jwt.sign({ sub: id, role: 'USER' })}`,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    for (const name of ['owner', 'second', 'member']) {
      const user = await prisma.user.create({
        data: {
          username: `admin_e2e_${name}_${suffix}`,
          email: `admin_e2e_${name}_${suffix}@example.test`,
          firstName: 'AdminTest',
          lastName: name,
          passwordHash: 'unused-test-fixture',
        },
      });
      ids.push(user.id);
    }
    [ownerId, secondId, userId] = ids;
    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        reportedUserId: secondId,
        reason: 'HARASSMENT',
        description: 'Test evidence for the review queue.',
      },
    });
    reportId = report.id;
    const sport = await prisma.sport.create({
      data: {
        name: `Admin test ${suffix}`,
        description: 'Temporary test sport',
      },
    });
    sportId = sport.id;
  });
  beforeEach(async () => {
    await prisma.user.updateMany({
      where: { id: { in: [ownerId, secondId] } },
      data: { role: 'SUPER_ADMIN', isActive: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'USER', isActive: true },
    });
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.report.deleteMany({ where: { id: reportId } });
      await prisma.adminAuditLog.deleteMany({
        where: { actorId: { in: ids } },
      });
      await prisma.sport.deleteMany({ where: { id: sportId } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('returns real counts and a complete seven-day chart', async () => {
    const response = await http()
      .get('/api/v1/admin/overview')
      .set(auth(ownerId))
      .expect(200);
    expect(response.body.users).toBeGreaterThanOrEqual(3);
    expect(response.body.dailyRegistrations).toHaveLength(7);
    expect(
      response.body.dailyRegistrations.reduce(
        (sum: number, day: { total: number }) => sum + day.total,
        0,
      ),
    ).toBeGreaterThanOrEqual(3);
  });
  it('searches accounts without leaking credentials', async () => {
    const response = await http()
      .get(`/api/v1/admin/users?search=${suffix}`)
      .set(auth(ownerId))
      .expect(200);
    expect(response.body.total).toBe(3);
    expect(response.text).not.toContain('passwordHash');
    expect(response.text).not.toContain('unused-test-fixture');
  });
  it('persists account changes and their before/after audit record', async () => {
    await http()
      .patch(`/api/v1/admin/users/${userId}`)
      .set(auth(ownerId))
      .send({ role: 'ADMIN', isActive: false })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.role).toBe('ADMIN');
    expect(user.isActive).toBe(false);
    const entry = await prisma.adminAuditLog.findFirstOrThrow({
      where: { targetId: userId, action: 'USER_UPDATED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry.details).toEqual(
      expect.objectContaining({
        before: { role: 'USER', isActive: true },
        after: { role: 'ADMIN', isActive: false },
      }),
    );
    await http().get('/api/v1/auth/me').set(auth(userId)).expect(401);
  });
  it('prevents mutually racing super admins from revoking each other', async () => {
    const results = await Promise.all([
      http()
        .patch(`/api/v1/admin/users/${secondId}`)
        .set(auth(ownerId))
        .send({ role: 'USER' }),
      http()
        .patch(`/api/v1/admin/users/${ownerId}`)
        .set(auth(secondId))
        .send({ role: 'USER' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 403]);
    expect(
      await prisma.user.count({
        where: {
          id: { in: [ownerId, secondId] },
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      }),
    ).toBe(1);
  });
  it('records report outcomes and rejects stale decisions', async () => {
    const response = await http()
      .get('/api/v1/admin/reports?status=PENDING')
      .set(auth(ownerId))
      .expect(200);
    expect(
      response.body.items.some((item: { id: string }) => item.id === reportId),
    ).toBe(true);
    await http()
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set(auth(ownerId))
      .send({ status: 'RESOLVED', expectedStatus: 'PENDING' })
      .expect(200);
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
    });
    expect(report.resolvedById).toBe(ownerId);
    expect(report.resolvedAt).toBeInstanceOf(Date);
    await http()
      .patch(`/api/v1/admin/reports/${reportId}`)
      .set(auth(secondId))
      .send({ status: 'DISMISSED', expectedStatus: 'PENDING' })
      .expect(409);
    const entries = await prisma.adminAuditLog.count({
      where: { targetId: reportId },
    });
    expect(entries).toBe(1);
  });
  it('retires a sport from user selections while preserving the record', async () => {
    await http()
      .patch(`/api/v1/admin/sports/${sportId}`)
      .set(auth(ownerId))
      .send({ isActive: false })
      .expect(200);
    const response = await http()
      .get('/api/v1/sports')
      .set(auth(userId))
      .expect(200);
    expect(
      response.body.some((sport: { id: string }) => sport.id === sportId),
    ).toBe(false);
    expect(
      await prisma.sport.findUnique({ where: { id: sportId } }),
    ).not.toBeNull();
    await http().get(`/api/v1/sports/${sportId}`).set(auth(userId)).expect(200);
    const audit = await http()
      .get('/api/v1/admin/audit')
      .set(auth(ownerId))
      .expect(200);
    expect(
      audit.body.items.some(
        (item: { action: string; targetId: string }) =>
          item.action === 'SPORT_STATUS_CHANGED' && item.targetId === sportId,
      ),
    ).toBe(true);
  });
});
