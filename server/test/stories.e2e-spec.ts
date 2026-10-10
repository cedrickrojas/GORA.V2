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

interface StoryBody {
  id: string;
  caption: string | null;
  visibility: string;
  mediaUrl: string;
  createdAt: string;
  expiresAt: string;
  author: { id: string };
  customViewers?: { id: string }[];
}

type Role = 'author' | 'friend' | 'chosen' | 'stranger' | 'blocked' | 'blocker';

const IMAGE_URL = 'https://cdn.example.test/story.jpg';

/**
 * Stories against the real database with throwaway users; everything created is removed.
 * Privacy is checked through HTTP, the way a client would try to bypass it.
 */
describe('Stories: privacy, edit, delete (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const users = {} as Record<Role, TestUser>;
  const stories: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function register(role: Role): Promise<TestUser> {
    const username = `e2e_st_${role}_${suffix}`;
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

  async function createStory(body: Record<string, unknown>) {
    const response = await http()
      .post('/api/v1/stories')
      .set(auth(users.author))
      .send({ mediaType: 'IMAGE', mediaUrl: IMAGE_URL, ...body })
      .expect(201);

    return response.body as StoryBody;
  }

  async function railIds(viewer: TestUser): Promise<string[]> {
    const response = await http()
      .get('/api/v1/stories')
      .set(auth(viewer))
      .expect(200);

    return (response.body as StoryBody[])
      .map((story) => story.id)
      .filter((id) => Object.values(stories).includes(id));
  }

  async function canOpen(viewer: TestUser, storyId: string): Promise<boolean> {
    const response = await http()
      .get(`/api/v1/stories/${storyId}`)
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

    stories.public = (await createStory({ visibility: 'PUBLIC' })).id;
    stories.friends = (await createStory({ visibility: 'FRIENDS' })).id;
    stories.onlyMe = (await createStory({ visibility: 'ONLY_ME' })).id;
    stories.custom = (
      await createStory({
        visibility: 'CUSTOM',
        customViewerIds: [users.chosen.id],
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    const ids = Object.values(users).map((user) => user.id);

    await prisma.story.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('creates a story that expires 24 hours after it is posted', async () => {
    const story = await http()
      .get(`/api/v1/stories/${stories.public}`)
      .set(auth(users.author))
      .expect(200);
    const body = story.body as StoryBody;

    expect(body.author.id).toBe(users.author.id);
    expect(body.mediaUrl).toBe(IMAGE_URL);
    expect(
      new Date(body.expiresAt).getTime() - new Date(body.createdAt).getTime(),
    ).toBe(24 * 60 * 60 * 1000);
  });

  it('shows each viewer exactly the stories they are allowed to see', async () => {
    const expected: Record<Role, string[]> = {
      author: [stories.public, stories.friends, stories.onlyMe, stories.custom],
      friend: [stories.public, stories.friends],
      chosen: [stories.public, stories.friends, stories.custom],
      stranger: [stories.public],
      blocked: [],
      blocker: [],
    };

    for (const [role, ids] of Object.entries(expected) as [Role, string[]][]) {
      expect((await railIds(users[role])).sort()).toEqual([...ids].sort());

      for (const storyId of Object.values(stories)) {
        expect(await canOpen(users[role], storyId)).toBe(ids.includes(storyId));
      }
    }
  });

  it('sends the custom viewer list only to the author', async () => {
    const own = await http()
      .get(`/api/v1/stories/${stories.custom}`)
      .set(auth(users.author))
      .expect(200);
    expect((own.body as StoryBody).customViewers).toEqual([
      expect.objectContaining({ id: users.chosen.id }) as unknown,
    ]);

    const seen = await http()
      .get(`/api/v1/stories/${stories.custom}`)
      .set(auth(users.chosen))
      .expect(200);
    expect((seen.body as StoryBody).customViewers).toBeUndefined();
  });

  it('counts only the stories the viewer may see on the profile', async () => {
    const own = await http()
      .get(`/api/v1/profiles/${users.author.username}`)
      .set(auth(users.stranger))
      .expect(200);

    expect(
      (own.body as { sections: { stories: number } }).sections.stories,
    ).toBe(1);
  });

  it('hides expired stories from others but keeps them in My Stories', async () => {
    const expired = await createStory({ visibility: 'PUBLIC' });
    await prisma.story.update({
      where: { id: expired.id },
      data: {
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    expect(await canOpen(users.friend, expired.id)).toBe(false);

    const rail = await http()
      .get('/api/v1/stories')
      .set(auth(users.author))
      .expect(200);
    expect((rail.body as StoryBody[]).map((story) => story.id)).not.toContain(
      expired.id,
    );

    const mine = await http()
      .get('/api/v1/stories/mine')
      .set(auth(users.author))
      .expect(200);
    expect((mine.body as StoryBody[]).map((story) => story.id)).toContain(
      expired.id,
    );
  });

  it('rejects invalid stories and fields the client may not set', async () => {
    const bad: Record<string, unknown>[] = [
      { mediaType: 'IMAGE', mediaUrl: 'not a url', visibility: 'PUBLIC' },
      { mediaType: 'IMAGE', mediaUrl: 'ftp://x.test/a', visibility: 'PUBLIC' },
      { mediaType: 'GIF', mediaUrl: IMAGE_URL, visibility: 'PUBLIC' },
      { mediaType: 'IMAGE', mediaUrl: IMAGE_URL },
      {
        mediaType: 'IMAGE',
        mediaUrl: IMAGE_URL,
        visibility: 'PUBLIC',
        caption: 'x'.repeat(501),
      },
      {
        mediaType: 'IMAGE',
        mediaUrl: IMAGE_URL,
        visibility: 'PUBLIC',
        userId: users.friend.id,
      },
      {
        mediaType: 'IMAGE',
        mediaUrl: IMAGE_URL,
        visibility: 'PUBLIC',
        expiresAt: '2099-01-01T00:00:00Z',
      },
      { mediaType: 'IMAGE', mediaUrl: IMAGE_URL, visibility: 'CUSTOM' },
      {
        mediaType: 'IMAGE',
        mediaUrl: IMAGE_URL,
        visibility: 'CUSTOM',
        customViewerIds: [users.author.id],
      },
      {
        mediaType: 'IMAGE',
        mediaUrl: IMAGE_URL,
        visibility: 'CUSTOM',
        customViewerIds: [users.blocked.id],
      },
      {
        mediaType: 'IMAGE',
        mediaUrl: IMAGE_URL,
        visibility: 'PUBLIC',
        customViewerIds: [users.friend.id],
      },
    ];

    for (const body of bad) {
      await http()
        .post('/api/v1/stories')
        .set(auth(users.author))
        .send(body)
        .expect(400);
    }

    await http()
      .post('/api/v1/stories')
      .send({ mediaType: 'IMAGE', mediaUrl: IMAGE_URL, visibility: 'PUBLIC' })
      .expect(401);
  });

  it('lets only the author edit the caption', async () => {
    const story = await createStory({ visibility: 'PUBLIC', caption: 'old' });

    const edited = await http()
      .patch(`/api/v1/stories/${story.id}`)
      .set(auth(users.author))
      .send({ caption: '  Game day!  ' })
      .expect(200);
    expect((edited.body as StoryBody).caption).toBe('Game day!');

    const cleared = await http()
      .patch(`/api/v1/stories/${story.id}`)
      .set(auth(users.author))
      .send({ caption: '   ' })
      .expect(200);
    expect((cleared.body as StoryBody).caption).toBeNull();

    await http()
      .patch(`/api/v1/stories/${story.id}`)
      .set(auth(users.author))
      .send({ caption: 'x'.repeat(501) })
      .expect(400);
    await http()
      .patch(`/api/v1/stories/${story.id}`)
      .set(auth(users.author))
      .send({ mediaUrl: IMAGE_URL })
      .expect(400);
    await http()
      .patch(`/api/v1/stories/${story.id}`)
      .set(auth(users.friend))
      .send({ caption: 'hijack' })
      .expect(403);
    await http()
      .patch(`/api/v1/stories/${stories.onlyMe}`)
      .set(auth(users.friend))
      .send({ caption: 'hijack' })
      .expect(404);
    await http()
      .patch(`/api/v1/stories/${randomUUID()}`)
      .set(auth(users.author))
      .send({ caption: 'x' })
      .expect(404);
    await http()
      .patch('/api/v1/stories/not-a-uuid')
      .set(auth(users.author))
      .send({ caption: 'x' })
      .expect(404);
  });

  it('applies a privacy change on the very next read', async () => {
    const story = await createStory({ visibility: 'PUBLIC' });
    expect(await canOpen(users.stranger, story.id)).toBe(true);

    await http()
      .patch(`/api/v1/stories/${story.id}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'ONLY_ME' })
      .expect(200);
    expect(await canOpen(users.stranger, story.id)).toBe(false);
    expect(await canOpen(users.friend, story.id)).toBe(false);

    const custom = await http()
      .patch(`/api/v1/stories/${story.id}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'CUSTOM', customViewerIds: [users.stranger.id] })
      .expect(200);
    expect((custom.body as StoryBody).visibility).toBe('CUSTOM');
    expect(await canOpen(users.stranger, story.id)).toBe(true);
    expect(await canOpen(users.friend, story.id)).toBe(false);

    await http()
      .patch(`/api/v1/stories/${story.id}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'FRIENDS' })
      .expect(200);
    expect(await canOpen(users.stranger, story.id)).toBe(false);
    expect(await canOpen(users.friend, story.id)).toBe(true);

    await http()
      .patch(`/api/v1/stories/${story.id}/visibility`)
      .set(auth(users.friend))
      .send({ visibility: 'PUBLIC' })
      .expect(403);
    await http()
      .patch(`/api/v1/stories/${story.id}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'EVERYONE' })
      .expect(400);
  });

  it('soft-deletes: hidden everywhere, the row is kept', async () => {
    const story = await createStory({ visibility: 'PUBLIC' });

    await http()
      .delete(`/api/v1/stories/${story.id}`)
      .set(auth(users.friend))
      .expect(403);

    const deleted = await http()
      .delete(`/api/v1/stories/${story.id}`)
      .set(auth(users.author))
      .expect(200);
    expect(deleted.body).toEqual({ id: story.id, deleted: true });

    for (const viewer of [users.author, users.friend]) {
      expect(await canOpen(viewer, story.id)).toBe(false);
      expect(await railIds(viewer)).not.toContain(story.id);
    }

    const mine = await http()
      .get('/api/v1/stories/mine')
      .set(auth(users.author))
      .expect(200);
    expect((mine.body as StoryBody[]).map((item) => item.id)).not.toContain(
      story.id,
    );

    await http()
      .delete(`/api/v1/stories/${story.id}`)
      .set(auth(users.author))
      .expect(404);
    await http()
      .patch(`/api/v1/stories/${story.id}`)
      .set(auth(users.author))
      .send({ caption: 'back' })
      .expect(404);

    const row = await prisma.story.findUnique({ where: { id: story.id } });
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it('is guarded by the database too', async () => {
    const base = {
      userId: users.author.id,
      mediaType: 'IMAGE' as const,
      expiresAt: new Date(Date.now() + 60_000),
    };

    await expect(
      prisma.story.create({ data: { ...base, mediaUrl: 'ftp://x.test/a' } }),
    ).rejects.toThrow();
    await expect(
      prisma.story.create({
        data: { ...base, mediaUrl: IMAGE_URL, caption: 'x'.repeat(501) },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.storyCustomViewer.create({
        data: { storyId: stories.custom, userId: users.author.id },
      }),
    ).rejects.toThrow();
  });
});
