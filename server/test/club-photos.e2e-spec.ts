import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1kAAAAASUVORK5CYII=';

describe('Club photo uploads (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: string,
    outsider: string,
    ownerToken: string,
    outsiderToken: string,
    sportId: string,
    clubId: string;
  const suffix = randomBytes(4).toString('hex');
  const clubIds: string[] = [];
  const created: string[] = [];
  const http = () => request(app.getHttpServer());
  const payload = (extra = {}) => ({
    name: 'Club Upload Test',
    username: 'club-photo-' + suffix,
    description: 'Photos saved with this club.',
    primarySportId: sportId,
    maxMembers: 10,
    ...extra,
  });
  const patch = (body: Record<string, unknown>, token = ownerToken) =>
    http()
      .patch('/api/v1/clubs/' + clubId)
      .auth(token, { type: 'bearer' })
      .send(body);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    sportId = (
      await prisma.sport.findFirstOrThrow({ where: { isActive: true } })
    ).id;
    for (const name of ['owner', 'outsider']) {
      const username = 'club_photo_' + name + '_' + suffix;
      const user = await prisma.user.create({
        data: {
          username,
          email: username + '@example.test',
          passwordHash: 'unusable-test-fixture',
          firstName: 'Photo',
          lastName: name,
        },
      });
      created.push(user.id);
    }
    [owner, outsider] = created;
    ownerToken = app.get(JwtService).sign({ sub: owner });
    outsiderToken = app.get(JwtService).sign({ sub: outsider });
  }, 60000);
  afterAll(async () => {
    if (prisma) {
      await prisma.conversation.deleteMany({
        where: { clubId: { in: clubIds } },
      });
      await prisma.club.deleteMany({ where: { id: { in: clubIds } } });
      await prisma.user.deleteMany({ where: { id: { in: created } } });
    }
    if (app) await app.close();
  });

  it('creates both uploads atomically and serves durable images without leaking bytes in club JSON', async () => {
    const result = await http()
      .post('/api/v1/clubs')
      .auth(ownerToken, { type: 'bearer' })
      .send(payload({ profilePhoto: PNG, coverPhoto: PNG }))
      .expect(201);
    clubId = result.body.id;
    clubIds.push(clubId);
    expect(result.body.profileImageUrl).toMatch(/\/photos\/profile\//);
    expect(result.body.coverImageUrl).toMatch(/\/photos\/cover\//);
    for (const url of [
      result.body.profileImageUrl,
      result.body.coverImageUrl,
    ]) {
      const photo = await http().get(url).expect(200);
      expect(photo.headers['content-type']).toContain('image/png');
      expect(photo.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.from(photo.body).toString('base64')).toBe(
        PNG.split(',')[1],
      );
    }
    expect(await prisma.clubPhoto.count({ where: { clubId } })).toBe(2);
    expect(JSON.stringify(result.body)).not.toContain('base64');
    expect(JSON.stringify(result.body)).not.toContain('contentType');
  });
  it('preserves images on text edits, replaces revisions and removes files', async () => {
    const saved = await patch({ about: 'New about text.' }).expect(200);
    const old = saved.body.profileImageUrl;
    const changed = await patch({ profilePhoto: PNG }).expect(200);
    expect(changed.body.profileImageUrl).not.toBe(old);
    expect(changed.body.coverImageUrl).toBe(saved.body.coverImageUrl);
    await http().get(old).expect(404);
    await http().get(changed.body.profileImageUrl).expect(200);
    const removed = await patch({
      profilePhoto: null,
      coverPhoto: null,
    }).expect(200);
    expect(removed.body.profileImageUrl).toBeNull();
    expect(removed.body.coverImageUrl).toBeNull();
    expect(await prisma.clubPhoto.count({ where: { clubId } })).toBe(0);
    await http().get(changed.body.coverImageUrl).expect(404);
  });
  it('enforces owner-only writes and validates file contents, size and ambiguous input', async () => {
    await patch({ profilePhoto: PNG }, outsiderToken).expect(403);
    await http()
      .patch('/api/v1/clubs/' + clubId)
      .send({ profilePhoto: PNG })
      .expect(401);
    for (const body of [
      { profilePhoto: 'https://example.com/x.png' },
      { profilePhoto: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { coverPhoto: 42 },
      { profilePhoto: PNG, profileImageUrl: 'https://example.com/x.png' },
      {
        profilePhoto:
          'data:image/png;base64,' + Buffer.alloc(262145).toString('base64'),
      },
    ])
      await patch(body).expect(400);
    expect(await prisma.clubPhoto.count({ where: { clubId } })).toBe(0);
  });
  it('rolls back creation if either photo is invalid and rejects unknown revisions', async () => {
    const username = 'invalid-photo-' + suffix;
    await http()
      .post('/api/v1/clubs')
      .auth(ownerToken, { type: 'bearer' })
      .send(
        payload({ username, profilePhoto: PNG, coverPhoto: 'not-an-image' }),
      )
      .expect(400);
    expect(await prisma.club.count({ where: { slug: username } })).toBe(0);
    expect(
      await prisma.clubPhoto.count({ where: { club: { slug: username } } }),
    ).toBe(0);
    await http()
      .get(
        `/api/v1/clubs/${clubId}/photos/invalid/11111111-1111-4111-8111-111111111111`,
      )
      .expect(404);
  });
});
