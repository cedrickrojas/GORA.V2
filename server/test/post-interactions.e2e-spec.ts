import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

interface TestUser {
  id: string;
  token: string;
}
interface PhotoPost {
  id: string;
  media: { id: string; mediaUrl: string }[];
  caption: string | null;
  commentCount: number;
  shareCount: number;
}
interface CommentResult {
  comment: { id: string; content: string; author: { id: string } };
  post: PhotoPost;
}

describe('Saved post photos, comments, and shares (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const users: TestUser[] = [];
  let post: PhotoPost;
  const image = Buffer.concat([
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=',
      'base64',
    ),
    Buffer.alloc(120_000),
  ]);
  const photo = `data:image/png;base64,${image.toString('base64')}`;
  const http = () => request(app.getHttpServer());
  const auth = (index: number) => ({
    Authorization: `Bearer ${users[index].token}`,
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const username = `e2e_post_${randomBytes(6).toString('hex')}`;
      const result = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: `${username}@example.test`,
          password: randomBytes(16).toString('hex'),
          firstName: 'Post',
          lastName: 'QA',
        })
        .expect(201);
      const body = result.body as { user: { id: string }; accessToken: string };
      users.push({ id: body.user.id, token: body.accessToken });
    }
  }, 120_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.post.deleteMany({
        where: { userId: { in: users.map((user) => user.id) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: users.map((user) => user.id) } },
      });
    }
    await app?.close();
  }, 60_000);

  it('saves a photo-only post above the default JSON limit and serves the original bytes after reload', async () => {
    const result = await http()
      .post('/api/v1/posts')
      .set(auth(0))
      .send({ caption: '', visibility: 'PUBLIC', photos: [photo, photo] })
      .expect(201);
    post = result.body as PhotoPost;
    expect(post.caption).toBeNull();
    expect(post.media).toHaveLength(2);
    expect(post).not.toHaveProperty('photoData');
    const loaded = await http()
      .get(`/api/v1/posts/${post.id}`)
      .set(auth(1))
      .expect(200);
    const viewerPhoto = (loaded.body as PhotoPost).media[0].mediaUrl;
    const response = await http()
      .get(viewerPhoto)
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store');
    expect(response.body as Buffer).toEqual(image);
    await http()
      .get(viewerPhoto.replace(post.media[0].id, post.media[1].id))
      .expect(401);
    await http()
      .get(`/api/v1/posts/${post.id}/media/${post.media[0].id}`)
      .expect(401);
    await http()
      .patch(`/api/v1/posts/${post.id}`)
      .set(auth(0))
      .send({ caption: '' })
      .expect(200);
  });

  it('rejects empty posts, fake images, excessive counts, and oversized photos without saving partial posts', async () => {
    const before = await prisma.post.count({ where: { userId: users[0].id } });
    for (const body of [
      { caption: ' ' },
      { photos: ['https://example.test/photo.jpg'] },
      { photos: ['data:image/svg+xml;base64,PHN2Zz4='] },
      { photos: ['data:image/png;base64,aGVsbG8='] },
      { photos: Array<string>(11).fill(photo) },
      {
        photos: [
          `data:image/png;base64,${Buffer.alloc(256 * 1024 + 1).toString('base64')}`,
        ],
      },
    ])
      await http()
        .post('/api/v1/posts')
        .set(auth(0))
        .send({ visibility: 'PUBLIC', ...body })
        .expect(400);
    expect(await prisma.post.count({ where: { userId: users[0].id } })).toBe(
      before,
    );
  });

  it('persists comments with server identity, validation, pagination, and author moderation', async () => {
    const path = `/api/v1/posts/${post.id}/comments`;
    await http().post(path).send({ content: 'anonymous' }).expect(401);
    for (const content of [' ', 'x'.repeat(2201)])
      await http().post(path).set(auth(1)).send({ content }).expect(400);
    const first = (
      await http()
        .post(path)
        .set(auth(1))
        .send({ content: '  First comment  ' })
        .expect(201)
    ).body as CommentResult;
    expect(first.comment).toMatchObject({
      content: 'First comment',
      author: { id: users[1].id },
    });
    expect(first.post.commentCount).toBe(1);
    const second = (
      await http()
        .post(path)
        .set(auth(0))
        .send({ content: 'Reply from author' })
        .expect(201)
    ).body as CommentResult;
    const page = (await http().get(`${path}?limit=1`).set(auth(2)).expect(200))
      .body as { comments: { id: string }[]; nextCursor: string };
    expect(page.comments[0].id).toBe(second.comment.id);
    expect(page.nextCursor).toBe(second.comment.id);
    const older = (
      await http()
        .get(`${path}?limit=1&cursor=${page.nextCursor}`)
        .set(auth(2))
        .expect(200)
    ).body as { comments: { id: string }[] };
    expect(older.comments[0].id).toBe(first.comment.id);
    await http().delete(`${path}/${first.comment.id}`).set(auth(2)).expect(403);
    await http()
      .delete(`/api/v1/posts/${randomUUID()}/comments/${first.comment.id}`)
      .set(auth(1))
      .expect(404);
    const removed = (
      await http()
        .delete(`${path}/${first.comment.id}`)
        .set(auth(1))
        .expect(200)
    ).body as PhotoPost;
    expect(removed.commentCount).toBe(1);
    const third = (
      await http()
        .post(path)
        .set(auth(1))
        .send({ content: 'Moderate me' })
        .expect(201)
    ).body as CommentResult;
    await http().delete(`${path}/${third.comment.id}`).set(auth(0)).expect(200);
    expect(await prisma.postComment.count({ where: { postId: post.id } })).toBe(
      1,
    );
  }, 60_000);

  it('records completed shares in PostgreSQL', async () => {
    const path = `/api/v1/posts/${post.id}/shares`;
    await http().post(path).expect(401);
    const shared = (await http().post(path).set(auth(1)).expect(201))
      .body as PhotoPost;
    expect(shared.shareCount).toBe(1);
    expect(
      await prisma.postShare.count({
        where: { postId: post.id, userId: users[1].id },
      }),
    ).toBe(1);
    const reloaded = (
      await http().get(`/api/v1/posts/${post.id}`).set(auth(2)).expect(200)
    ).body as PhotoPost;
    expect(reloaded.shareCount).toBe(1);
  });

  it('rechecks privacy for old photo links, comments, and shares after audience changes and deletion', async () => {
    const prior = (
      await http().get(`/api/v1/posts/${post.id}`).set(auth(1)).expect(200)
    ).body as PhotoPost;
    await http()
      .patch(`/api/v1/posts/${post.id}/visibility`)
      .set(auth(0))
      .send({ visibility: 'ONLY_ME' })
      .expect(200);
    await http().get(prior.media[0].mediaUrl).expect(404);
    await http().get(post.media[0].mediaUrl).expect(200);
    await http()
      .get(`/api/v1/posts/${post.id}/comments`)
      .set(auth(1))
      .expect(404);
    await http()
      .post(`/api/v1/posts/${post.id}/comments`)
      .set(auth(1))
      .send({ content: 'Hidden' })
      .expect(404);
    await http()
      .post(`/api/v1/posts/${post.id}/shares`)
      .set(auth(1))
      .expect(404);
    await http().delete(`/api/v1/posts/${post.id}`).set(auth(0)).expect(200);
    await http().get(post.media[0].mediaUrl).expect(404);
    await http()
      .get(`/api/v1/posts/${post.id}/comments`)
      .set(auth(0))
      .expect(404);
  }, 60_000);
});
