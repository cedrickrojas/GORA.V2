import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { toPairKey } from '../src/social/relationship';

interface Account {
  id: string;
  username: string;
  accessToken: string;
}
interface Snapshot {
  blockedIds: string[];
  friends: { id: string }[];
  requests: {
    id: string;
    direction: string;
    player: { id: string };
    mutualFriends: number;
  }[];
}

describe('Real friendships and the mutual friends feed (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const accounts: Account[] = [];
  const posts: Record<string, string> = {};
  const suffix = randomBytes(5).toString('hex');
  let alice: Account;
  let bob: Account;
  let outsider: Account;
  let requestId: string;
  const http = () => request(app.getHttpServer());
  const auth = (user: Account) => ({
    Authorization: `Bearer ${user.accessToken}`,
  });
  const snapshot = async (user: Account): Promise<Snapshot> =>
    (await http().get('/api/v1/friends').set(auth(user)).expect(200))
      .body as Snapshot;
  const feedIds = async (user: Account) => {
    const response = await http()
      .get('/api/v1/posts?scope=FRIENDS&limit=50')
      .set(auth(user))
      .expect(200);
    return (response.body as { posts: { id: string }[] }).posts.map(
      (post) => post.id,
    );
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (const name of ['alice', 'bob', 'outsider']) {
      const username = `friend_${name}_${suffix}`;
      const response = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: `${username}@example.test`,
          password: `Pw-${randomBytes(16).toString('hex')}`,
          firstName: 'Friend Test',
          lastName: name,
        })
        .expect(201);
      const body = response.body as {
        user: { id: string };
        accessToken: string;
      };
      accounts.push({
        id: body.user.id,
        username,
        accessToken: body.accessToken,
      });
    }
    [alice, bob, outsider] = accounts;
    for (const [label, author, visibility] of [
      ['aliceFriends', alice, 'FRIENDS'],
      ['bobFriends', bob, 'FRIENDS'],
      ['bobPublic', bob, 'PUBLIC'],
      ['bobPrivate', bob, 'ONLY_ME'],
      ['bobCustom', bob, 'CUSTOM'],
      ['outsiderPublic', outsider, 'PUBLIC'],
    ] as const) {
      const response = await http()
        .post('/api/v1/posts')
        .set(auth(author))
        .send({
          caption: label,
          visibility,
          ...(visibility === 'CUSTOM'
            ? { customViewerIds: [outsider.id] }
            : {}),
        })
        .expect(201);
      posts[label] = (response.body as { id: string }).id;
    }
  }, 60_000);

  afterAll(async () => {
    try {
      if (prisma) {
        const ids = accounts.map((user) => user.id);
        await prisma.post.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      if (app) await app.close();
    }
  });

  it('requires authentication and searches real accounts without exposing private fields', async () => {
    await http().get('/api/v1/friends').expect(401);
    const response = await http()
      .get(`/api/v1/friends/players?q=${bob.username}`)
      .set(auth(alice))
      .expect(200);
    expect(response.body).toEqual([
      expect.objectContaining({ id: bob.id, username: bob.username }),
    ]);
    expect(
      Object.keys((response.body as Record<string, unknown>[])[0]).sort(),
    ).toEqual([
      'city',
      'firstName',
      'id',
      'lastName',
      'profileImageUrl',
      'username',
    ]);
    await http()
      .post(`/api/v1/friends/requests/${alice.username}`)
      .set(auth(alice))
      .expect(400);
  });

  it('saves one pending request, which does not grant Friends post access', async () => {
    for (let i = 0; i < 2; i++)
      await http()
        .post(`/api/v1/friends/requests/${bob.username}`)
        .set(auth(alice))
        .expect(201);
    const sent = await snapshot(alice);
    const received = await snapshot(bob);
    expect(sent.requests).toHaveLength(1);
    expect(sent.requests[0]).toMatchObject({
      direction: 'SENT',
      player: { id: bob.id },
    });
    expect(received.requests[0]).toMatchObject({
      direction: 'RECEIVED',
      player: { id: alice.id },
    });
    requestId = sent.requests[0].id;
    expect(received.requests[0].id).toBe(requestId);
    await http()
      .post(`/api/v1/friends/requests/${alice.username}`)
      .set(auth(bob))
      .expect(409);
    await http()
      .get(`/api/v1/posts/${posts.bobFriends}`)
      .set(auth(alice))
      .expect(404);
    expect(await feedIds(alice)).toEqual([posts.aliceFriends]);
    await http()
      .post(`/api/v1/friends/requests/${requestId}/accept`)
      .set(auth(alice))
      .expect(404);
    await http()
      .post(`/api/v1/friends/requests/${requestId}/accept`)
      .set(auth(outsider))
      .expect(404);
    await http()
      .delete(`/api/v1/friends/requests/${requestId}`)
      .set(auth(outsider))
      .expect(404);
  });

  it('rejects repeated and oversized search parameters as bad requests', async () => {
    for (const query of [
      'q=alice&q=bob',
      `q=${'a'.repeat(81)}`,
      'unexpected=value',
    ]) {
      await http()
        .get(`/api/v1/friends/players?${query}`)
        .set(auth(alice))
        .expect(400);
    }
    await http()
      .get('/api/v1/friends/players')
      .set(auth(alice))
      .expect(200, []);
  });

  it('acceptance makes both users mutual friends and exposes their existing Friends posts immediately', async () => {
    await http()
      .post(`/api/v1/friends/requests/${requestId}/accept`)
      .set(auth(bob))
      .expect(201);
    expect((await snapshot(alice)).friends).toContainEqual(
      expect.objectContaining({ id: bob.id }),
    );
    expect((await snapshot(bob)).friends).toContainEqual(
      expect.objectContaining({ id: alice.id }),
    );
    expect((await snapshot(alice)).requests).toEqual([]);
    for (const [viewer, expected] of [
      [alice, 'bobFriends'],
      [bob, 'aliceFriends'],
    ] as const) {
      await http()
        .get(`/api/v1/posts/${posts[expected]}`)
        .set(auth(viewer))
        .expect(200);
      expect(await feedIds(viewer)).toContain(posts[expected]);
    }
    const ids = await feedIds(alice);
    expect(ids).toContain(posts.bobPublic);
    for (const label of ['bobPrivate', 'bobCustom', 'outsiderPublic'])
      expect(ids).not.toContain(posts[label]);
    await http()
      .get(`/api/v1/posts/${posts.bobPrivate}`)
      .set(auth(alice))
      .expect(404);
    await http()
      .get(`/api/v1/posts/${posts.bobCustom}`)
      .set(auth(alice))
      .expect(404);
    const relationship = await http()
      .get(`/api/v1/users/${bob.username}/relationship`)
      .set(auth(alice))
      .expect(200);
    expect(relationship.body).toMatchObject({ state: 'FRIENDS' });
  });

  it('keeps friend posts available on later pages and hides outsiders', async () => {
    const first = await http()
      .get('/api/v1/posts?scope=FRIENDS&limit=1')
      .set(auth(alice))
      .expect(200);
    const page = first.body as { posts: { id: string }[]; nextCursor: string };
    const next = await http()
      .get(`/api/v1/posts?scope=FRIENDS&limit=1&cursor=${page.nextCursor}`)
      .set(auth(alice))
      .expect(200);
    expect((next.body as { posts: { id: string }[] }).posts[0].id).not.toBe(
      page.posts[0].id,
    );
    await http()
      .get('/api/v1/posts?scope=INVALID')
      .set(auth(alice))
      .expect(400);
  });

  it('counts real mutual friends, persists decline/cancel, and permits a later request', async () => {
    await http()
      .post(`/api/v1/friends/requests/${outsider.username}`)
      .set(auth(alice))
      .expect(201);
    const id = (await snapshot(outsider)).requests[0].id;
    await http()
      .post(`/api/v1/friends/requests/${id}/accept`)
      .set(auth(outsider))
      .expect(201);
    await http()
      .post(`/api/v1/friends/requests/${bob.username}`)
      .set(auth(outsider))
      .expect(201);
    const incoming = (await snapshot(bob)).requests.find(
      (item) => item.player.id === outsider.id,
    )!;
    expect(incoming.mutualFriends).toBe(1);
    await http()
      .delete(`/api/v1/friends/requests/${incoming.id}`)
      .set(auth(bob))
      .expect(200);
    expect((await snapshot(outsider)).requests).toEqual([]);
    await http()
      .post(`/api/v1/friends/requests/${bob.username}`)
      .set(auth(outsider))
      .expect(201);
    await http()
      .delete(`/api/v1/friends/requests/${incoming.id}`)
      .set(auth(outsider))
      .expect(200);
  });

  it('unfriending removes Friends access in both directions while retaining public access', async () => {
    await http()
      .delete(`/api/v1/friends/${bob.username}`)
      .set(auth(alice))
      .expect(200);
    await http()
      .get(`/api/v1/posts/${posts.bobFriends}`)
      .set(auth(alice))
      .expect(404);
    await http()
      .get(`/api/v1/posts/${posts.aliceFriends}`)
      .set(auth(bob))
      .expect(404);
    await http()
      .get(`/api/v1/posts/${posts.bobPublic}`)
      .set(auth(alice))
      .expect(200);
    expect(await feedIds(alice)).not.toContain(posts.bobPublic);
    expect((await snapshot(bob)).friends).not.toContainEqual(
      expect.objectContaining({ id: alice.id }),
    );
  });

  it('blocks prevent requests/search/access and only the blocker can unblock', async () => {
    await prisma.friendship.update({
      where: { pairKey: toPairKey(alice.id, bob.id) },
      data: { status: 'BLOCKED', blockedById: bob.id },
    });
    await http()
      .post(`/api/v1/friends/requests/${bob.username}`)
      .set(auth(alice))
      .expect(404);
    await http()
      .delete(`/api/v1/friends/blocks/${bob.username}`)
      .set(auth(alice))
      .expect(404);
    expect((await snapshot(alice)).blockedIds).not.toContain(bob.id);
    expect((await snapshot(bob)).blockedIds).toContain(alice.id);
    const found = await http()
      .get(`/api/v1/friends/players?q=${bob.username}`)
      .set(auth(alice))
      .expect(200);
    expect(found.body).toEqual([]);
    await http()
      .get(`/api/v1/posts/${posts.bobPublic}`)
      .set(auth(alice))
      .expect(404);
    await http()
      .delete(`/api/v1/friends/blocks/${alice.username}`)
      .set(auth(bob))
      .expect(200);
    await http()
      .post(`/api/v1/friends/requests/${bob.username}`)
      .set(auth(alice))
      .expect(201);
  });
});
