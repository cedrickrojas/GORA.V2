import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { toPairKey } from '../src/social/relationship';

interface TestUser {
  id: string;
  username: string;
  token: string;
}
interface Profile {
  coverImageUrl: string | null;
}

describe('Persisted profile cover photos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const users: TestUser[] = [];
  let ownerUrl: string;
  let visitorUrl: string;
  const bytes = Buffer.concat([
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
      'base64',
    ),
    Buffer.alloc(120_000),
  ]);
  const photo = `data:image/png;base64,${bytes.toString('base64')}`;
  const http = () => request(app.getHttpServer());
  const auth = (index = 0) => ({
    Authorization: `Bearer ${users[index].token}`,
  });
  const coverUrl = (body: unknown) => {
    expect(body).not.toHaveProperty('coverPhotoData');
    expect(body).not.toHaveProperty('coverPhotoRevision');
    const url = (body as Profile).coverImageUrl;
    expect(url).toMatch(/^\/api\/v1\/profiles\/.+\/cover\/.+\?token=/);
    return url!;
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (let i = 0; i < 2; i++) {
      const username = `e2e_cover_${randomBytes(6).toString('hex')}`;
      const response = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: `${username}@example.test`,
          password: randomBytes(16).toString('hex'),
          firstName: 'Cover',
          lastName: 'QA',
        })
        .expect(201);
      const result = response.body as {
        user: { id: string };
        accessToken: string;
      };
      users.push({ id: result.user.id, username, token: result.accessToken });
    }
  }, 120_000);

  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    await app?.close();
  }, 60_000);

  it('requires the owner session and rejects invalid photo payloads without changing the profile', async () => {
    await http().put('/api/v1/profiles/me/cover').send({ photo }).expect(401);
    await http().delete('/api/v1/profiles/me/cover').expect(401);
    for (const invalid of [
      'https://example.com/photo.png',
      'data:image/png;base64,aGVsbG8=',
      'data:image/svg+xml;base64,PHN2Zy8+',
      `data:image/png;base64,${Buffer.alloc(262_145).toString('base64')}`,
    ]) {
      await http()
        .put('/api/v1/profiles/me/cover')
        .set(auth())
        .send({ photo: invalid })
        .expect(400);
    }
    await http()
      .put('/api/v1/profiles/me/cover')
      .set(auth())
      .send({ photo, userId: users[1].id })
      .expect(400);
    expect(
      await prisma.user.findUnique({
        where: { id: users[0].id },
        select: { coverPhotoData: true },
      }),
    ).toEqual({ coverPhotoData: null });
  });

  it('saves a photo above the default JSON limit and returns signed readable covers for owner and visitor', async () => {
    const saved = await http()
      .put('/api/v1/profiles/me/cover')
      .set(auth())
      .send({ photo })
      .expect(200);
    ownerUrl = coverUrl(saved.body);
    const reloaded = await http()
      .get('/api/v1/profiles/me')
      .set(auth())
      .expect(200);
    await http()
      .get(coverUrl(reloaded.body))
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store')
      .then((response) => expect(response.body as Buffer).toEqual(bytes));
    const visitor = await http()
      .get(`/api/v1/profiles/${users[0].username}`)
      .set(auth(1))
      .expect(200);
    visitorUrl = coverUrl(visitor.body);
    expect(visitorUrl).toContain(users[1].id);
    await http().get(visitorUrl).expect(200);
    await http().get(ownerUrl.split('?')[0]).expect(401);
    await http().get(ownerUrl.replace(users[0].id, users[1].id)).expect(401);
    await http()
      .get(ownerUrl.replace(/cover\/[a-f0-9-]+/, `cover/${randomUUID()}`))
      .expect(401);
    const edited = await http()
      .patch('/api/v1/profiles/me')
      .set(auth())
      .send({ bio: 'My saved cover stays here' })
      .expect(200);
    await http().get(coverUrl(edited.body)).expect(200);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: users[0].id },
      select: {
        coverPhotoData: true,
        coverPhotoType: true,
        coverImageUrl: true,
      },
    });
    expect(Buffer.from(stored.coverPhotoData!)).toEqual(bytes);
    expect(stored.coverPhotoType).toBe('image/png');
    expect(stored.coverImageUrl).toBeNull();
  });

  it('honors blocks and account deactivation even for previously issued cover links', async () => {
    await prisma.friendship.create({
      data: {
        requesterId: users[0].id,
        receiverId: users[1].id,
        pairKey: toPairKey(users[0].id, users[1].id),
        status: 'BLOCKED',
        blockedById: users[0].id,
      },
    });
    await http().get(visitorUrl).expect(404);
    await http().get(ownerUrl).expect(200);
    await prisma.friendship.deleteMany({
      where: { pairKey: toPairKey(users[0].id, users[1].id) },
    });
    await prisma.user.update({
      where: { id: users[1].id },
      data: { isActive: false },
    });
    await http().get(visitorUrl).expect(404);
    await prisma.user.update({
      where: { id: users[1].id },
      data: { isActive: true },
    });
    await prisma.user.update({
      where: { id: users[0].id },
      data: { isActive: false },
    });
    await http().get(ownerUrl).expect(404);
    await prisma.user.update({
      where: { id: users[0].id },
      data: { isActive: true },
    });
  });

  it('replaces and removes covers, invalidates old links, and still supports external cover URLs', async () => {
    const replaced = await http()
      .put('/api/v1/profiles/me/cover')
      .set(auth())
      .send({ photo })
      .expect(200);
    const replacement = coverUrl(replaced.body);
    expect(replacement).not.toBe(ownerUrl);
    await http().get(ownerUrl).expect(404);
    await http().get(replacement).expect(200);
    const external = await http()
      .patch('/api/v1/profiles/me')
      .set(auth())
      .send({ coverImageUrl: 'https://example.com/cover.jpg' })
      .expect(200);
    expect((external.body as Profile).coverImageUrl).toBe(
      'https://example.com/cover.jpg',
    );
    await http().get(replacement).expect(404);
    const uploaded = await http()
      .put('/api/v1/profiles/me/cover')
      .set(auth())
      .send({ photo })
      .expect(200);
    const removed = await http()
      .delete('/api/v1/profiles/me/cover')
      .set(auth())
      .expect(200);
    expect((removed.body as Profile).coverImageUrl).toBeNull();
    await http().get(coverUrl(uploaded.body)).expect(404);
    expect(
      await prisma.user.findUnique({
        where: { id: users[0].id },
        select: {
          coverPhotoData: true,
          coverPhotoType: true,
          coverPhotoRevision: true,
        },
      }),
    ).toEqual({
      coverPhotoData: null,
      coverPhotoType: null,
      coverPhotoRevision: null,
    });
  });
});
