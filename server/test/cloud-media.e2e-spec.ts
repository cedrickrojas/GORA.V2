import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { BlobGateway } from '../src/common/media/blob.gateway';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const media = new Map<string, { bytes: Buffer; contentType: string }>();
const blobs = {
  mint: jest.fn(async () => 'scoped-test-client-token'),
  head: jest.fn(async (pathname: string) => {
    const item = media.get(pathname)!;
    return {
      url: 'https://test.private.blob.vercel-storage.com/' + pathname,
      size: item.bytes.length,
      contentType: item.contentType,
    };
  }),
  get: jest.fn(async (pathname: string, range?: string) => {
    const item = media.get(pathname)!;
    let bytes = item.bytes;
    const headers = new Headers();
    if (range) {
      const match = /bytes=(\d+)-(\d+)/.exec(range)!;
      const start = Number(match[1]),
        end = Math.min(Number(match[2]), bytes.length - 1);
      headers.set('content-range', `bytes ${start}-${end}/${bytes.length}`);
      bytes = bytes.subarray(start, end + 1);
    }
    return {
      statusCode: 200,
      headers,
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < bytes.length; i += 5)
            controller.enqueue(bytes.subarray(i, i + 5));
          controller.close();
        },
      }),
    };
  }),
  remove: jest.fn(async (pathname: string) => {
    media.delete(pathname);
  }),
};

describe('Direct private cloud uploads (database + mocked storage boundary)', () => {
  let app: INestApplication<App>, prisma: PrismaService;
  const users: { id: string; token: string }[] = [];
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  const http = () => request(app.getHttpServer());
  const start = (input: object, user = users[0]) =>
    http()
      .post('/api/v1/media/uploads')
      .auth(user.token, { type: 'bearer' })
      .send(input);
  const complete = (uploadId: string, input: object = {}, user = users[0]) =>
    http()
      .post('/api/v1/stories/upload/complete')
      .auth(user.token, { type: 'bearer' })
      .send({ uploadId, mediaType: 'IMAGE', visibility: 'ONLY_ME', ...input });
  async function photo() {
    const response = await start({
      resource: 'stories',
      contentType: 'image/png',
      size: PNG.length,
    }).expect(201);
    const ticket = response.body as { uploadId: string; pathname: string };
    media.set(ticket.pathname, { bytes: PNG, contentType: 'image/png' });
    return ticket;
  }
  beforeAll(async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'server-only-test-token';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BlobGateway)
      .useValue(blobs)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    for (const role of ['owner', 'viewer']) {
      const username = 'cloud_' + role + '_' + randomBytes(5).toString('hex');
      const response = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: username + '@example.test',
          password: randomBytes(24).toString('hex'),
          firstName: 'Cloud',
          lastName: role,
        })
        .expect(201);
      const account = response.body as {
        user: { id: string };
        accessToken: string;
      };
      users.push({ id: account.user.id, token: account.accessToken });
    }
  });
  afterEach(async () => {
    await prisma.cloudMediaUpload.deleteMany({
      where: { userId: { in: users.map((u) => u.id) }, claimedAt: null },
    });
    media.clear();
  });
  afterAll(async () => {
    if (prisma) {
      const ids = users.map((u) => u.id);
      await prisma.story.deleteMany({ where: { userId: { in: ids } } });
      await prisma.reel.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  });
  it('requires authentication and validates file metadata before issuing a ticket', async () => {
    await http().get('/api/v1/media/uploads/config').expect(401);
    await http().post('/api/v1/media/uploads').send({}).expect(401);
    await start({
      resource: 'stories',
      contentType: 'image/svg+xml',
      size: 20,
    }).expect(400);
    await start({
      resource: 'stories',
      contentType: 'image/png',
      size: 11 * 1024 * 1024,
    }).expect(400);
    await start({
      resource: 'reels',
      contentType: 'image/png',
      size: 20,
    }).expect(400);
    await start({
      resource: 'reels',
      contentType: 'video/mp4',
      size: 51 * 1024 * 1024,
    }).expect(400);
    await start({
      resource: 'stories',
      contentType: 'image/png',
      size: 20,
      userId: users[1].id,
    }).expect(400);
  });
  it('shares only the owner upload once, persists it, and keeps completed media on late cancellation', async () => {
    const ticket = await photo();
    await complete(ticket.uploadId, {}, users[1]).expect(404);
    const response = await complete(ticket.uploadId, {
      caption: 'Cloud photo',
    }).expect(201);
    const story = response.body as { id: string; mediaUrl: string };
    const row = await prisma.story.findUniqueOrThrow({
      where: { id: story.id },
    });
    expect(row.mediaUrl).toBe(`blob:${ticket.uploadId}.png`);
    expect(JSON.stringify(response.body)).not.toContain('vercel-storage.com');
    const file = await http().get(story.mediaUrl).expect(200);
    expect(file.body).toEqual(PNG);
    await complete(ticket.uploadId).expect(404);
    await http()
      .delete('/api/v1/media/uploads/' + ticket.uploadId)
      .auth(users[0].token, { type: 'bearer' })
      .expect(204);
    expect(media.has(ticket.pathname)).toBe(true);
    await http()
      .get('/api/v1/stories/' + story.id)
      .auth(users[1].token, { type: 'bearer' })
      .expect(404);
    await http()
      .patch('/api/v1/stories/' + story.id + '/visibility')
      .auth(users[0].token, { type: 'bearer' })
      .send({ visibility: 'PUBLIC' })
      .expect(200);
    const visible = await http()
      .get('/api/v1/stories/' + story.id)
      .auth(users[1].token, { type: 'bearer' })
      .expect(200);
    await http()
      .get((visible.body as { mediaUrl: string }).mediaUrl)
      .expect(200);
    await http()
      .patch('/api/v1/stories/' + story.id + '/visibility')
      .auth(users[0].token, { type: 'bearer' })
      .send({ visibility: 'ONLY_ME' })
      .expect(200);
    await http()
      .get((visible.body as { mediaUrl: string }).mediaUrl)
      .expect(404);
  });
  it('rolls back ticket consumption if the final audience is rejected', async () => {
    const ticket = await photo();
    await complete(ticket.uploadId, {
      visibility: 'CUSTOM',
      customViewerIds: [randomUUID()],
    }).expect(400);
    expect(
      (
        await prisma.cloudMediaUpload.findUniqueOrThrow({
          where: { id: ticket.uploadId },
        })
      ).claimedAt,
    ).toBeNull();
    await http()
      .delete('/api/v1/media/uploads/' + ticket.uploadId)
      .auth(users[1].token, { type: 'bearer' })
      .expect(204);
    expect(media.has(ticket.pathname)).toBe(true);
    await http()
      .delete('/api/v1/media/uploads/' + ticket.uploadId)
      .auth(users[0].token, { type: 'bearer' })
      .expect(204);
    expect(media.has(ticket.pathname)).toBe(false);
  });
  it('rejects false content, expired uploads, and tickets for another resource', async () => {
    const ticket = await photo();
    media.set(ticket.pathname, {
      bytes: Buffer.alloc(PNG.length),
      contentType: 'image/png',
    });
    await complete(ticket.uploadId).expect(400);
    media.set(ticket.pathname, { bytes: PNG, contentType: 'image/png' });
    await http()
      .post('/api/v1/reels/upload/complete')
      .auth(users[0].token, { type: 'bearer' })
      .send({ uploadId: ticket.uploadId, visibility: 'ONLY_ME' })
      .expect(404);
    await prisma.cloudMediaUpload.update({
      where: { id: ticket.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await complete(ticket.uploadId).expect(404);
  });
  it('stores video beyond the Function body limit and serves authorized byte ranges', async () => {
    const bytes = Buffer.alloc(5 * 1024 * 1024 + 1);
    Buffer.from('000000186674797069736f6d', 'hex').copy(bytes);
    const started = await start({
      resource: 'reels',
      contentType: 'video/mp4',
      size: bytes.length,
    }).expect(201);
    const ticket = started.body as { uploadId: string; pathname: string };
    media.set(ticket.pathname, { bytes, contentType: 'video/mp4' });
    const response = await http()
      .post('/api/v1/reels/upload/complete')
      .auth(users[0].token, { type: 'bearer' })
      .send({
        uploadId: ticket.uploadId,
        visibility: 'ONLY_ME',
        durationSeconds: 7,
      })
      .expect(201);
    const reel = response.body as { id: string; videoUrl: string };
    const file = await http()
      .get(reel.videoUrl)
      .set('Range', 'bytes=0-3')
      .expect(206);
    expect(file.body).toEqual(bytes.subarray(0, 4));
    await http().get(reel.videoUrl).set('Range', 'bytes=99999999-').expect(416);
    await http()
      .get('/api/v1/reels/' + reel.id)
      .auth(users[1].token, { type: 'bearer' })
      .expect(404);
    await http()
      .delete('/api/v1/reels/' + reel.id)
      .auth(users[0].token, { type: 'bearer' })
      .expect(200);
    expect(media.has(ticket.pathname)).toBe(false);
    await http().get(reel.videoUrl).expect(404);
  });
});
