import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
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

interface ReelBody {
  id: string;
  caption: string | null;
  visibility: string;
  videoUrl: string;
  durationSeconds: number | null;
  sport: { id: string; name: string } | null;
  author: { id: string };
  likeCount: number;
  customViewers?: { id: string }[];
}

type Role = 'author' | 'friend' | 'chosen' | 'stranger' | 'blocked' | 'blocker';

const VIDEO_URL = 'https://cdn.example.test/reel.mp4';

/**
 * Reels (Profile Highlights, My Reels, the Reels tab) against the real database with
 * throwaway users; everything created is removed.
 */
describe('Reels: privacy, edit, delete (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const users = {} as Record<Role, TestUser>;
  const reels: Record<string, string> = {};
  let sportId: string;

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function register(role: Role): Promise<TestUser> {
    const username = `e2e_rl_${role}_${suffix}`;
    const response = await http()
      .post('/api/v1/auth/register')
      .send({
        username,
        email: `${username}@example.test`,
        password: `Pw-${randomBytes(12).toString('hex')}`,
        firstName: 'E2E',
        lastName: role,
      })
      .expect(201);
    const body = response.body as { user: { id: string }; accessToken: string };

    return { id: body.user.id, username, token: body.accessToken };
  }

  async function befriend(
    requester: TestUser,
    receiver: TestUser,
    status: 'ACCEPTED' | 'BLOCKED',
    blockedBy?: TestUser,
  ) {
    await prisma.friendship.create({
      data: {
        requesterId: requester.id,
        receiverId: receiver.id,
        pairKey: toPairKey(requester.id, receiver.id),
        status,
        blockedById: blockedBy?.id ?? null,
      },
    });
  }

  async function createReel(body: Record<string, unknown>) {
    const response = await http()
      .post('/api/v1/reels')
      .set(auth(users.author))
      .send({ videoUrl: VIDEO_URL, ...body })
      .expect(201);

    return response.body as ReelBody;
  }

  /** Null when the profile itself is hidden (the author blocked the viewer). */
  async function profileReelIds(viewer: TestUser): Promise<string[] | null> {
    const response = await http()
      .get(`/api/v1/users/${users.author.username}/reels`)
      .set(auth(viewer));

    expect([200, 404]).toContain(response.status);
    return response.status === 200
      ? (response.body as { reels: ReelBody[] }).reels.map((reel) => reel.id)
      : null;
  }

  async function feedIds(viewer: TestUser): Promise<string[]> {
    const response = await http()
      .get('/api/v1/reels?limit=50')
      .set(auth(viewer))
      .expect(200);

    return (response.body as { reels: ReelBody[] }).reels
      .map((reel) => reel.id)
      .filter((id) => Object.values(reels).includes(id));
  }

  async function canOpen(viewer: TestUser, reelId: string): Promise<boolean> {
    const response = await http()
      .get(`/api/v1/reels/${reelId}`)
      .set(auth(viewer));

    expect([200, 404]).toContain(response.status);
    return response.status === 200;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    const sport = await prisma.sport.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    sportId = sport.id;

    for (const role of [
      'author',
      'friend',
      'chosen',
      'stranger',
      'blocked',
      'blocker',
    ] as const) {
      users[role] = await register(role);
    }

    await befriend(users.author, users.friend, 'ACCEPTED');
    await befriend(users.chosen, users.author, 'ACCEPTED');
    await befriend(users.author, users.blocked, 'BLOCKED', users.author);
    await befriend(users.blocker, users.author, 'BLOCKED', users.blocker);

    reels.public = (await createReel({ visibility: 'PUBLIC', sportId })).id;
    reels.friends = (await createReel({ visibility: 'FRIENDS' })).id;
    reels.onlyMe = (await createReel({ visibility: 'ONLY_ME' })).id;
    reels.custom = (
      await createReel({
        visibility: 'CUSTOM',
        customViewerIds: [users.chosen.id],
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    const ids = Object.values(users).map((user) => user.id);

    await prisma.reel.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('creates a reel with its sport and counts', async () => {
    const reel = await http()
      .get(`/api/v1/reels/${reels.public}`)
      .set(auth(users.author))
      .expect(200);
    const body = reel.body as ReelBody;

    expect(body.author.id).toBe(users.author.id);
    expect(body.videoUrl).toBe(VIDEO_URL);
    expect(body.sport?.id).toBe(sportId);
    expect(body.likeCount).toBe(0);
  });

  it('persists idempotent likes and prevents reactions to hidden reels', async () => {
    const target = `/api/v1/reels/${reels.public}`;
    await http().put(`${target}/like`).expect(401);
    for (let i = 0; i < 2; i++) {
      expect(
        (await http().put(`${target}/like`).set(auth(users.friend)).expect(200))
          .body,
      ).toMatchObject({ likeCount: 1, likedByViewer: true });
    }
    expect(
      (await http().get(target).set(auth(users.friend)).expect(200)).body,
    ).toMatchObject({ likeCount: 1, likedByViewer: true });
    expect(
      (await http().get(target).set(auth(users.author)).expect(200)).body,
    ).toMatchObject({ likeCount: 1, likedByViewer: false });
    for (const id of [reels.onlyMe, reels.friends, reels.custom]) {
      await http()
        .put(`/api/v1/reels/${id}/like`)
        .set(auth(users.stranger))
        .expect(404);
      await http()
        .delete(`/api/v1/reels/${id}/like`)
        .set(auth(users.stranger))
        .expect(404);
    }
    await http().put(`${target}/like`).set(auth(users.blocked)).expect(404);
    for (let i = 0; i < 2; i++) {
      expect(
        (
          await http()
            .delete(`${target}/like`)
            .set(auth(users.friend))
            .expect(200)
        ).body,
      ).toMatchObject({ likeCount: 0, likedByViewer: false });
    }
  });

  it('shows each viewer exactly the reels they are allowed to see', async () => {
    const expected: Record<Role, string[]> = {
      author: [reels.public, reels.friends, reels.onlyMe, reels.custom],
      friend: [reels.public, reels.friends],
      chosen: [reels.public, reels.friends, reels.custom],
      stranger: [reels.public],
      blocked: [],
      blocker: [],
    };

    for (const [role, ids] of Object.entries(expected) as [Role, string[]][]) {
      const listed = await profileReelIds(users[role]);

      if (role === 'blocked') {
        expect(listed).toBeNull();
      } else {
        expect(listed?.sort()).toEqual([...ids].sort());
      }

      expect((await feedIds(users[role])).sort()).toEqual([...ids].sort());

      for (const reelId of Object.values(reels)) {
        expect(await canOpen(users[role], reelId)).toBe(ids.includes(reelId));
      }
    }
  });

  it('sends the custom viewer list only to the author', async () => {
    const own = await http()
      .get(`/api/v1/reels/${reels.custom}`)
      .set(auth(users.author))
      .expect(200);
    expect((own.body as ReelBody).customViewers).toEqual([
      expect.objectContaining({ id: users.chosen.id }) as unknown,
    ]);

    const seen = await http()
      .get(`/api/v1/reels/${reels.custom}`)
      .set(auth(users.chosen))
      .expect(200);
    expect((seen.body as ReelBody).customViewers).toBeUndefined();
  });

  it('counts only the reels the viewer may see on the profile', async () => {
    const counts = async (viewer: TestUser) => {
      const response = await http()
        .get(`/api/v1/profiles/${users.author.username}`)
        .set(auth(viewer))
        .expect(200);
      return (response.body as { sections: { reels: number } }).sections.reels;
    };

    expect(await counts(users.stranger)).toBe(1);
    expect(await counts(users.friend)).toBe(2);
    expect(await counts(users.chosen)).toBe(3);
  });

  it('rejects invalid reels and fields the client may not set', async () => {
    const bad: Record<string, unknown>[] = [
      { videoUrl: 'not a url', visibility: 'PUBLIC' },
      { videoUrl: 'javascript:alert(1)', visibility: 'PUBLIC' },
      { videoUrl: VIDEO_URL },
      { videoUrl: VIDEO_URL, visibility: 'PUBLIC', caption: 'x'.repeat(2201) },
      { videoUrl: VIDEO_URL, visibility: 'PUBLIC', durationSeconds: 0 },
      { videoUrl: VIDEO_URL, visibility: 'PUBLIC', durationSeconds: 601 },
      { videoUrl: VIDEO_URL, visibility: 'PUBLIC', sportId: 'basketball' },
      { videoUrl: VIDEO_URL, visibility: 'PUBLIC', sportId: randomUUID() },
      { videoUrl: VIDEO_URL, visibility: 'PUBLIC', userId: users.friend.id },
      { videoUrl: VIDEO_URL, visibility: 'PUBLIC', viewCount: 1000 },
      { videoUrl: VIDEO_URL, visibility: 'CUSTOM' },
      {
        videoUrl: VIDEO_URL,
        visibility: 'CUSTOM',
        customViewerIds: [users.blocker.id],
      },
    ];

    for (const body of bad) {
      await http()
        .post('/api/v1/reels')
        .set(auth(users.author))
        .send(body)
        .expect(400);
    }
  });

  it('lets only the author edit the caption and sport', async () => {
    const reel = await createReel({ visibility: 'PUBLIC', caption: 'old' });

    const edited = await http()
      .patch(`/api/v1/reels/${reel.id}`)
      .set(auth(users.author))
      .send({ caption: ' Buzzer beater ', sportId })
      .expect(200);
    expect((edited.body as ReelBody).caption).toBe('Buzzer beater');
    expect((edited.body as ReelBody).sport?.id).toBe(sportId);

    const cleared = await http()
      .patch(`/api/v1/reels/${reel.id}`)
      .set(auth(users.author))
      .send({ caption: null, sportId: null })
      .expect(200);
    expect((cleared.body as ReelBody).caption).toBeNull();
    expect((cleared.body as ReelBody).sport).toBeNull();

    await http()
      .patch(`/api/v1/reels/${reel.id}`)
      .set(auth(users.author))
      .send({ videoUrl: VIDEO_URL })
      .expect(400);
    await http()
      .patch(`/api/v1/reels/${reel.id}`)
      .set(auth(users.author))
      .send({ sportId: randomUUID() })
      .expect(400);
    await http()
      .patch(`/api/v1/reels/${reel.id}`)
      .set(auth(users.friend))
      .send({ caption: 'hijack' })
      .expect(403);
    await http()
      .patch(`/api/v1/reels/${reels.onlyMe}`)
      .set(auth(users.friend))
      .send({ caption: 'hijack' })
      .expect(404);
    await http()
      .patch('/api/v1/reels/not-a-uuid')
      .set(auth(users.author))
      .send({ caption: 'x' })
      .expect(404);
  });

  it('applies a privacy change on the very next read', async () => {
    const reel = await createReel({ visibility: 'PUBLIC' });
    expect(await canOpen(users.stranger, reel.id)).toBe(true);

    await http()
      .patch(`/api/v1/reels/${reel.id}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'ONLY_ME' })
      .expect(200);
    expect(await canOpen(users.stranger, reel.id)).toBe(false);
    expect(await canOpen(users.friend, reel.id)).toBe(false);

    await http()
      .patch(`/api/v1/reels/${reel.id}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'CUSTOM', customViewerIds: [users.stranger.id] })
      .expect(200);
    expect(await canOpen(users.stranger, reel.id)).toBe(true);
    expect(await canOpen(users.friend, reel.id)).toBe(false);

    await http()
      .patch(`/api/v1/reels/${reel.id}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'FRIENDS' })
      .expect(200);
    expect(await canOpen(users.stranger, reel.id)).toBe(false);
    expect(await canOpen(users.friend, reel.id)).toBe(true);

    await http()
      .patch(`/api/v1/reels/${reel.id}/visibility`)
      .set(auth(users.friend))
      .send({ visibility: 'PUBLIC' })
      .expect(403);
  });

  it('soft-deletes: hidden everywhere, the row is kept', async () => {
    const reel = await createReel({ visibility: 'PUBLIC' });

    await http()
      .delete(`/api/v1/reels/${reel.id}`)
      .set(auth(users.friend))
      .expect(403);

    const deleted = await http()
      .delete(`/api/v1/reels/${reel.id}`)
      .set(auth(users.author))
      .expect(200);
    expect(deleted.body).toEqual({ id: reel.id, deleted: true });

    for (const viewer of [users.author, users.friend]) {
      expect(await canOpen(viewer, reel.id)).toBe(false);
      expect(await profileReelIds(viewer)).not.toContain(reel.id);
    }

    await http()
      .delete(`/api/v1/reels/${reel.id}`)
      .set(auth(users.author))
      .expect(404);

    const row = await prisma.reel.findUnique({ where: { id: reel.id } });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it('is guarded by the database too', async () => {
    await expect(
      prisma.reel.create({
        data: { userId: users.author.id, videoUrl: 'ftp://x.test/a' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.reelCustomViewer.create({
        data: { reelId: reels.custom, userId: users.author.id },
      }),
    ).rejects.toThrow();
  });
});
