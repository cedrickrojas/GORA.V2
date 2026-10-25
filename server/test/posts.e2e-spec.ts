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

interface PostBody {
  id: string;
  visibility: string;
  author: { id: string; username: string };
  customViewers?: { id: string }[];
  tags: { id: string }[];
  location: { name: string; latitude: number; longitude: number } | null;
}

type Role =
  | 'author'
  | 'friend'
  | 'chosen'
  | 'stranger'
  | 'pending'
  | 'blocked'
  | 'blocker';

/**
 * Runs against the real database with throwaway users, and removes everything it creates.
 * Every privacy rule is checked through HTTP, the same way a client would try to bypass it.
 */
describe('Post privacy and relationships (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomBytes(4).toString('hex');
  const users = {} as Record<Role, TestUser>;
  const posts: Record<string, string> = {};
  let clubId: string | null = null;

  const http = () => request(app.getHttpServer());
  const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

  async function register(role: Role): Promise<TestUser> {
    const username = `e2e_${role}_${suffix}`;
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
    status: 'ACCEPTED' | 'PENDING' | 'BLOCKED',
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

  async function createPost(body: Record<string, unknown>) {
    const response = await http()
      .post('/api/v1/posts')
      .set(auth(users.author))
      .send({ caption: 'e2e post', ...body })
      .expect(201);

    return response.body as PostBody;
  }

  /** Null when the profile itself is hidden (the author blocked the viewer). */
  async function visibleIds(viewer: TestUser): Promise<string[] | null> {
    const response = await http()
      .get(`/api/v1/users/${users.author.username}/posts`)
      .set(auth(viewer));

    expect([200, 404]).toContain(response.status);
    return response.status === 200
      ? (response.body as { posts: PostBody[] }).posts.map((post) => post.id)
      : null;
  }

  async function canOpen(viewer: TestUser, postId: string): Promise<boolean> {
    const response = await http()
      .get(`/api/v1/posts/${postId}`)
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
      'pending',
      'blocked',
      'blocker',
    ] as const) {
      users[role] = await register(role);
    }

    await befriend(users.author, users.friend, 'ACCEPTED');
    await befriend(users.chosen, users.author, 'ACCEPTED');
    await befriend(users.pending, users.author, 'PENDING');
    await befriend(users.author, users.blocked, 'BLOCKED', users.author);
    await befriend(users.blocker, users.author, 'BLOCKED', users.blocker);

    posts.public = (await createPost({ visibility: 'PUBLIC' })).id;
    posts.friends = (await createPost({ visibility: 'FRIENDS' })).id;
    posts.onlyMe = (await createPost({ visibility: 'ONLY_ME' })).id;
    posts.custom = (
      await createPost({
        visibility: 'CUSTOM',
        customViewerIds: [users.chosen.id],
      })
    ).id;
  }, 60_000);

  afterAll(async () => {
    const ids = Object.values(users).map((user) => user.id);

    await prisma.post.deleteMany({ where: { userId: { in: ids } } });
    if (clubId) {
      await prisma.club.delete({ where: { id: clubId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('shows each viewer exactly the posts they are allowed to see', async () => {
    const expected: Record<Role, string[]> = {
      author: [posts.public, posts.friends, posts.onlyMe, posts.custom],
      friend: [posts.public, posts.friends],
      chosen: [posts.public, posts.friends, posts.custom],
      stranger: [posts.public],
      pending: [posts.public],
      blocked: [],
      blocker: [],
    };

    for (const [role, ids] of Object.entries(expected) as [Role, string[]][]) {
      const listed = await visibleIds(users[role]);

      if (role === 'blocked') {
        expect(listed).toBeNull();
      } else {
        expect(listed?.sort()).toEqual([...ids].sort());
      }

      for (const postId of Object.values(posts)) {
        expect(await canOpen(users[role], postId)).toBe(ids.includes(postId));
      }
    }
  });

  it('sends the custom viewer list only to the author', async () => {
    const own = await http()
      .get(`/api/v1/posts/${posts.custom}`)
      .set(auth(users.author))
      .expect(200);
    expect((own.body as PostBody).customViewers).toEqual([
      expect.objectContaining({ id: users.chosen.id }) as unknown,
    ]);

    const chosen = await http()
      .get(`/api/v1/posts/${posts.custom}`)
      .set(auth(users.chosen))
      .expect(200);
    expect(chosen.body).not.toHaveProperty('customViewers');
  });

  it('persists idempotent likes and checks the post audience before changing reactions', async () => {
    const target = `/api/v1/posts/${posts.public}`;
    await http().put(`${target}/like`).expect(401);
    for (let i = 0; i < 2; i++) {
      const result = await http()
        .put(`${target}/like`)
        .set(auth(users.friend))
        .expect(200);
      expect(result.body).toMatchObject({ likeCount: 1, likedByViewer: true });
    }
    expect(
      (await http().get(target).set(auth(users.friend)).expect(200)).body,
    ).toMatchObject({ likeCount: 1, likedByViewer: true });
    expect(
      (await http().get(target).set(auth(users.author)).expect(200)).body,
    ).toMatchObject({ likeCount: 1, likedByViewer: false });
    for (const id of [posts.onlyMe, posts.friends, posts.custom]) {
      await http()
        .put(`/api/v1/posts/${id}/like`)
        .set(auth(users.stranger))
        .expect(404);
      await http()
        .delete(`/api/v1/posts/${id}/like`)
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

  it('validates the audience when creating a post', async () => {
    const attempts: Record<string, unknown>[] = [
      { visibility: 'CUSTOM' },
      { visibility: 'CUSTOM', customViewerIds: [] },
      { visibility: 'CUSTOM', customViewerIds: [users.author.id] },
      { visibility: 'CUSTOM', customViewerIds: [users.blocked.id] },
      { visibility: 'CUSTOM', customViewerIds: [users.blocker.id] },
      {
        visibility: 'CUSTOM',
        customViewerIds: ['00000000-0000-4000-8000-000000000000'],
      },
      { visibility: 'PUBLIC', customViewerIds: [users.chosen.id] },
      { visibility: 'SECRET' },
      { visibility: 'PUBLIC', caption: '   ' },
      { visibility: 'PUBLIC', userId: users.friend.id },
    ];

    for (const body of attempts) {
      await http()
        .post('/api/v1/posts')
        .set(auth(users.author))
        .send({ caption: 'e2e post', ...body })
        .expect(400);
    }

    await http()
      .post('/api/v1/posts')
      .send({ caption: 'no token', visibility: 'PUBLIC' })
      .expect(401);
  });

  it('applies a privacy change immediately and only for the author', async () => {
    const path = `/api/v1/posts/${posts.public}/visibility`;

    await http()
      .patch(path)
      .set(auth(users.stranger))
      .send({ visibility: 'ONLY_ME' })
      .expect(403);

    await http()
      .patch(`/api/v1/posts/${posts.onlyMe}/visibility`)
      .set(auth(users.stranger))
      .send({ visibility: 'PUBLIC' })
      .expect(404);

    await http()
      .patch(path)
      .set(auth(users.author))
      .send({ visibility: 'ONLY_ME' })
      .expect(200);
    expect(await canOpen(users.stranger, posts.public)).toBe(false);
    expect(await canOpen(users.friend, posts.public)).toBe(false);

    const custom = await http()
      .patch(path)
      .set(auth(users.author))
      .send({ visibility: 'CUSTOM', customViewerIds: [users.stranger.id] })
      .expect(200);
    expect((custom.body as PostBody).customViewers).toHaveLength(1);
    expect(await canOpen(users.stranger, posts.public)).toBe(true);
    expect(await canOpen(users.chosen, posts.public)).toBe(false);

    await http()
      .patch(path)
      .set(auth(users.author))
      .send({ visibility: 'FRIENDS' })
      .expect(200);
    expect(await canOpen(users.stranger, posts.public)).toBe(false);
    expect(await canOpen(users.friend, posts.public)).toBe(true);

    await http()
      .patch(path)
      .set(auth(users.author))
      .send({ visibility: 'CUSTOM' })
      .expect(200);
    expect(await canOpen(users.stranger, posts.public)).toBe(true);

    await http()
      .patch(`/api/v1/posts/${posts.friends}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'CUSTOM' })
      .expect(400);

    await http()
      .patch(path)
      .set(auth(users.author))
      .send({ visibility: 'PUBLIC' })
      .expect(200);
    expect(await canOpen(users.stranger, posts.public)).toBe(true);
  });

  it('hides private club posts from non-members', async () => {
    const club = await prisma.club.create({
      data: {
        ownerId: users.author.id,
        name: 'E2E Private Club',
        slug: `e2e-private-${suffix}`,
        isPublic: false,
        maxMembers: 50,
      },
      select: { id: true },
    });
    clubId = club.id;

    const post = await prisma.post.create({
      data: {
        userId: users.author.id,
        clubId,
        caption: 'members only',
        visibility: 'PUBLIC',
      },
      select: { id: true },
    });

    expect(await canOpen(users.author, post.id)).toBe(true);
    expect(await canOpen(users.stranger, post.id)).toBe(false);

    await prisma.clubMember.create({
      data: { clubId, userId: users.stranger.id, status: 'ACTIVE' },
    });
    expect(await canOpen(users.stranger, post.id)).toBe(true);
  });

  it('stores tags and a chosen location, and validates both', async () => {
    const venue = {
      name: 'Riverside Sports Center',
      latitude: 14.5547,
      longitude: 121.0244,
    };
    const created = await createPost({
      visibility: 'PUBLIC',
      taggedUserIds: [users.friend.id, users.stranger.id],
      location: venue,
    });
    posts.tagged = created.id;

    expect(created.location).toEqual(venue);
    expect(created.tags.map((tag) => tag.id)).toEqual([
      users.friend.id,
      users.stranger.id,
    ]);

    const plain = await http()
      .get(`/api/v1/posts/${posts.public}`)
      .set(auth(users.author))
      .expect(200);
    expect((plain.body as PostBody).location).toBeNull();
    expect((plain.body as PostBody).tags).toEqual([]);

    const attempts: Record<string, unknown>[] = [
      { taggedUserIds: [users.friend.id, users.friend.id] },
      { taggedUserIds: [users.author.id] },
      { taggedUserIds: [users.blocked.id] },
      { taggedUserIds: [users.blocker.id] },
      { taggedUserIds: ['00000000-0000-4000-8000-000000000000'] },
      { taggedUserIds: 'everyone' },
      { location: 'Riverside' },
      { location: { name: 'Riverside' } },
      { location: { ...venue, name: '  ' } },
      { location: { ...venue, latitude: 91 } },
      { location: { ...venue, longitude: -181 } },
      { location: { ...venue, latitude: '14.5' } },
      { location: { ...venue, city: 'Manila' } },
    ];

    for (const body of attempts) {
      await http()
        .post('/api/v1/posts')
        .set(auth(users.author))
        .send({ caption: 'e2e post', visibility: 'PUBLIC', ...body })
        .expect(400);
    }
  });

  it('lets only the author manage tags', async () => {
    const path = `/api/v1/posts/${posts.tagged}/tags`;
    const tagIds = (body: unknown) =>
      (body as PostBody).tags.map((tag) => tag.id);

    await http()
      .put(path)
      .set(auth(users.friend))
      .send({ userIds: [] })
      .expect(403);
    await http()
      .put(`/api/v1/posts/${posts.onlyMe}/tags`)
      .set(auth(users.friend))
      .send({ userIds: [] })
      .expect(404);
    await http()
      .put(path)
      .set(auth(users.author))
      .send({ userIds: [users.author.id] })
      .expect(400);

    const removed = await http()
      .put(path)
      .set(auth(users.author))
      .send({ userIds: [users.stranger.id] })
      .expect(200);
    expect(tagIds(removed.body)).toEqual([users.stranger.id]);

    const added = await http()
      .put(path)
      .set(auth(users.author))
      .send({ userIds: [users.stranger.id, users.chosen.id] })
      .expect(200);
    expect(tagIds(added.body)).toEqual([users.stranger.id, users.chosen.id]);

    const cleared = await http()
      .put(path)
      .set(auth(users.author))
      .send({ userIds: [] })
      .expect(200);
    expect(tagIds(cleared.body)).toEqual([]);
  });

  it('hides tagged people the viewer has a block with', async () => {
    const post = await createPost({
      visibility: 'PUBLIC',
      taggedUserIds: [users.friend.id, users.stranger.id],
    });

    await befriend(users.stranger, users.pending, 'BLOCKED', users.stranger);
    try {
      const seen = await http()
        .get(`/api/v1/posts/${post.id}`)
        .set(auth(users.pending))
        .expect(200);
      expect((seen.body as PostBody).tags.map((tag) => tag.id)).toEqual([
        users.friend.id,
      ]);
    } finally {
      await prisma.friendship.delete({
        where: { pairKey: toPairKey(users.stranger.id, users.pending.id) },
      });
    }
  });

  it('enforces tag and location rules in the database too', async () => {
    const postId = posts.tagged;

    await prisma.postTag.create({ data: { postId, userId: users.friend.id } });
    await expect(
      prisma.postTag.create({ data: { postId, userId: users.friend.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.postTag.create({ data: { postId, userId: users.author.id } }),
    ).rejects.toThrow();

    for (const location of [
      { locationName: 'Court only', latitude: null, longitude: null },
      { locationName: null, latitude: 14.5, longitude: 121 },
      { locationName: 'Court', latitude: 14.5, longitude: null },
      { locationName: ' ', latitude: 14.5, longitude: 121 },
      { locationName: 'Court', latitude: 95, longitude: 121 },
    ]) {
      await expect(
        prisma.post.update({ where: { id: postId }, data: location }),
      ).rejects.toThrow();
    }
  });

  it('reports the relationship that drives the profile buttons', async () => {
    const stateOf = async (viewer: TestUser, target: TestUser) => {
      const response = await http()
        .get(`/api/v1/users/${target.username}/relationship`)
        .set(auth(viewer));

      return response.status === 200
        ? (response.body as { state: string; messageAccess: string })
        : response.status;
    };

    expect(await stateOf(users.author, users.author)).toMatchObject({
      state: 'SELF',
      messageAccess: 'NONE',
    });
    expect(await stateOf(users.author, users.friend)).toMatchObject({
      state: 'FRIENDS',
      messageAccess: 'DIRECT',
    });
    expect(await stateOf(users.author, users.stranger)).toMatchObject({
      state: 'NO_RELATIONSHIP',
      messageAccess: 'REQUEST',
    });
    expect(await stateOf(users.pending, users.author)).toMatchObject({
      state: 'REQUEST_SENT',
    });
    expect(await stateOf(users.author, users.pending)).toMatchObject({
      state: 'REQUEST_RECEIVED',
    });
    expect(await stateOf(users.author, users.blocked)).toMatchObject({
      state: 'BLOCKED',
      messageAccess: 'NONE',
    });
    expect(await stateOf(users.blocked, users.author)).toBe(404);
    expect(await stateOf(users.author, users.blocker)).toBe(404);
  });

  it('serves a Home feed of visible posts, newest first', async () => {
    const feedIds = async (viewer: TestUser) => {
      const response = await http()
        .get('/api/v1/posts?limit=50')
        .set(auth(viewer))
        .expect(200);
      return (response.body as { posts: PostBody[] }).posts.map(
        (post) => post.id,
      );
    };

    const newest = await createPost({ visibility: 'PUBLIC' });
    const authorFeed = await feedIds(users.author);
    const ownIds = new Set([newest.id, ...Object.values(posts)]);
    // Other suites may post at the same time, so only the author's own posts are ordered here.
    expect(authorFeed.filter((id) => ownIds.has(id))[0]).toBe(newest.id);
    expect(authorFeed).toEqual(
      expect.arrayContaining([posts.onlyMe, posts.custom]),
    );

    const strangerFeed = await feedIds(users.stranger);
    expect(strangerFeed).toContain(newest.id);
    expect(strangerFeed).not.toContain(posts.friends);
    expect(strangerFeed).not.toContain(posts.onlyMe);
    expect(await feedIds(users.blocked)).not.toContain(newest.id);

    await http().get('/api/v1/posts').expect(401);
  });

  it('lets only the author edit the caption, sport, and location', async () => {
    const basketball = await prisma.sport.findFirstOrThrow({
      where: { name: 'Basketball' },
    });
    const post = await createPost({ visibility: 'PUBLIC' });
    const editUrl = `/api/v1/posts/${post.id}`;

    const unchanged = await http()
      .patch(editUrl)
      .set(auth(users.author))
      .send({ caption: 'e2e post' })
      .expect(200);
    expect(unchanged.body).toMatchObject({ editedAt: null });

    const edited = await http()
      .patch(editUrl)
      .set(auth(users.author))
      .send({
        caption: '  Edited caption  ',
        sportId: basketball.id,
        location: { name: 'BGC Court', latitude: 14.55, longitude: 121.05 },
      })
      .expect(200);
    const body = edited.body as PostBody & {
      caption: string;
      sport: { id: string; name: string } | null;
      editedAt: string | null;
      visibility: string;
    };
    expect(body).toMatchObject({
      caption: 'Edited caption',
      sport: { id: basketball.id, name: 'Basketball' },
      location: { name: 'BGC Court', latitude: 14.55, longitude: 121.05 },
      visibility: 'PUBLIC',
    });
    expect(body.editedAt).not.toBeNull();

    const cleared = await http()
      .patch(editUrl)
      .set(auth(users.author))
      .send({ sportId: null, location: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      caption: 'Edited caption',
      sport: null,
      location: null,
    });

    for (const bad of [
      { caption: '   ' },
      { caption: null },
      { caption: 'x'.repeat(2201) },
      { sportId: 'not-a-uuid' },
      { location: { name: 'Court', latitude: 95, longitude: 121 } },
      { visibility: 'ONLY_ME' },
      { userId: users.stranger.id },
    ]) {
      await http().patch(editUrl).set(auth(users.author)).send(bad).expect(400);
    }

    await http()
      .patch(editUrl)
      .set(auth(users.friend))
      .send({ caption: 'hijack' })
      .expect(403);
    await http()
      .patch(`/api/v1/posts/${posts.onlyMe}`)
      .set(auth(users.stranger))
      .send({ caption: 'hijack' })
      .expect(404);
    await http()
      .patch(editUrl)
      .set(auth(users.author))
      .send({ sportId: '00000000-0000-4000-8000-000000000000' })
      .expect(400);

    const stored = await prisma.post.findUniqueOrThrow({
      where: { id: post.id },
    });
    expect(stored.caption).toBe('Edited caption');
  });

  it('soft-deletes a post for the author only and hides it everywhere', async () => {
    const post = await createPost({ visibility: 'PUBLIC' });
    const url = `/api/v1/posts/${post.id}`;

    await http().delete(url).set(auth(users.friend)).expect(403);
    await http()
      .delete(`/api/v1/posts/${posts.onlyMe}`)
      .set(auth(users.stranger))
      .expect(404);
    expect(await canOpen(users.friend, post.id)).toBe(true);

    const deleted = await http()
      .delete(url)
      .set(auth(users.author))
      .expect(200);
    expect(deleted.body).toEqual({ id: post.id, deleted: true });

    expect(await canOpen(users.author, post.id)).toBe(false);
    expect(await canOpen(users.friend, post.id)).toBe(false);
    expect(await visibleIds(users.author)).not.toContain(post.id);
    const feed = await http()
      .get('/api/v1/posts?limit=50')
      .set(auth(users.author))
      .expect(200);
    expect(
      (feed.body as { posts: PostBody[] }).posts.map((item) => item.id),
    ).not.toContain(post.id);

    await http().delete(url).set(auth(users.author)).expect(404);
    await http()
      .patch(url)
      .set(auth(users.author))
      .send({ caption: 'back?' })
      .expect(404);
    await http()
      .patch(`${url}/visibility`)
      .set(auth(users.author))
      .send({ visibility: 'PUBLIC' })
      .expect(404);

    const stored = await prisma.post.findUniqueOrThrow({
      where: { id: post.id },
    });
    expect(stored.deletedAt).not.toBeNull();
    expect(stored.caption).toBe('e2e post');
  });
});
