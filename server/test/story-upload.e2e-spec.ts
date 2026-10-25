import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import {
  PHOTO_MAX_BYTES,
  VIDEO_MAX_BYTES,
} from '../src/common/media/private-media.storage';
import { PrismaService } from '../src/prisma/prisma.service';
import { toPairKey } from '../src/social/relationship';
import { StoryMediaStorage } from '../src/stories/story-media.storage';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const WEBM = Buffer.from(
  '1a45dfa39f4286810142f7810142f2810442f381084282847765626d',
  'hex',
);
interface UploadedStory {
  id: string;
  mediaType: string;
  mediaUrl: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
}

describe('Story photo and video uploads (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let media: StoryMediaStorage;
  let directory: string;
  const accounts: { id: string; token: string }[] = [];
  const http = () => request(app.getHttpServer());
  const upload = (type = 'IMAGE', visibility = 'ONLY_ME') =>
    http()
      .post('/api/v1/stories/upload')
      .auth(accounts[0].token, { type: 'bearer' })
      .field('mediaType', type)
      .field('visibility', visibility);
  const attach = (
    call: ReturnType<typeof upload>,
    buffer = PNG,
    contentType = 'image/png',
  ) =>
    call.attach('media', buffer, {
      filename: '../../unsafe-name.png',
      contentType,
    });

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'gora-story-upload-'));
    media = new StoryMediaStorage(
      new ConfigService({
        JWT_SECRET: process.env.JWT_SECRET,
        STORY_UPLOAD_DIR: directory,
      }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StoryMediaStorage)
      .useValue(media)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (const role of ['author', 'viewer']) {
      const username = `e2e_story_${role}_${randomBytes(4).toString('hex')}`;
      const response = await http()
        .post('/api/v1/auth/register')
        .send({
          username,
          email: `${username}@example.test`,
          password: randomBytes(20).toString('hex'),
          firstName: 'Upload',
          lastName: role,
        })
        .expect(201);
      const body = response.body as {
        user: { id: string };
        accessToken: string;
      };
      accounts.push({ id: body.user.id, token: body.accessToken });
    }
    await prisma.friendship.create({
      data: {
        requesterId: accounts[0].id,
        receiverId: accounts[1].id,
        pairKey: toPairKey(accounts[0].id, accounts[1].id),
        status: 'ACCEPTED',
      },
    });
  });
  afterAll(async () => {
    if (prisma) {
      const ids = accounts.map((a) => a.id);
      await prisma.story.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
    if (directory) {
      for (const name of await readdir(directory))
        await rm(join(directory, name));
      await rmdir(directory);
    }
  });

  it('requires login, a supported file and valid metadata before storing a story', async () => {
    await http()
      .post('/api/v1/stories/upload')
      .field('mediaType', 'IMAGE')
      .expect(401);
    await upload().expect(400);
    await attach(upload(), Buffer.from('not a photo')).expect(400);
    await attach(upload('VIDEO')).expect(400);
    await attach(upload(), WEBM, 'video/webm').expect(400);
    await attach(upload('INVALID')).expect(400);
    await attach(
      upload('IMAGE', 'CUSTOM').field('customViewerIds', 'broken-json'),
    ).expect(400);
    await attach(upload().field('authorId', accounts[1].id)).expect(400);
    await attach(upload().field('caption', 'x'.repeat(501))).expect(400);
    expect(await readdir(directory)).toEqual([]);
  });

  it('enforces image and video size limits without leaving files', async () => {
    const oversized = Buffer.alloc(PHOTO_MAX_BYTES + 1);
    PNG.copy(oversized);
    await attach(upload(), oversized).expect(400);
    await attach(
      upload('VIDEO'),
      Buffer.alloc(VIDEO_MAX_BYTES + 1),
      'video/webm',
    ).expect(413);
    expect(await readdir(directory)).toEqual([]);
  });

  it('cleans up the saved file when the audience is rejected', async () => {
    await attach(
      upload('IMAGE', 'CUSTOM').field(
        'customViewerIds',
        JSON.stringify([randomUUID()]),
      ),
    ).expect(400);
    expect(await readdir(directory)).toEqual([]);
  });

  it('saves exact photo bytes and restores a scoped media URL after refresh', async () => {
    const response = await attach(
      upload().field('caption', ' Game day '),
    ).expect(201);
    const story = response.body as UploadedStory;
    expect(story.caption).toBe('Game day');
    expect(Date.parse(story.expiresAt) - Date.parse(story.createdAt)).toBe(
      24 * 60 * 60 * 1000,
    );
    const row = await prisma.story.findUniqueOrThrow({
      where: { id: story.id },
    });
    expect(row.userId).toBe(accounts[0].id);
    expect(row.mediaUrl).toMatch(/^upload:[a-f0-9-]{36}\.png$/);
    expect(
      await readFile(join(directory, row.mediaUrl.slice('upload:'.length))),
    ).toEqual(PNG);
    const reloaded = await http()
      .get(`/api/v1/stories/${story.id}`)
      .auth(accounts[0].token, { type: 'bearer' })
      .expect(200);
    const url = (reloaded.body as UploadedStory).mediaUrl;
    const file = await http().get(url).expect(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect(file.body).toEqual(PNG);
    await http().get(`/api/v1/stories/${story.id}/media`).expect(401);
    await http().get(`${url}x`).expect(401);
    await http().get(url.replace(story.id, randomUUID())).expect(401);
    await http().get(media.playbackUrl(story.id, accounts[1].id)).expect(404);
    const oldClock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() - 13 * 60 * 60 * 1000);
    const expired = media.playbackUrl(story.id, accounts[0].id);
    oldClock.mockRestore();
    await http().get(expired).expect(401);
    await http()
      .delete(`/api/v1/stories/${story.id}`)
      .auth(accounts[0].token, { type: 'bearer' })
      .expect(200);
    await http().get(url).expect(404);
    expect(await readdir(directory)).not.toContain(
      row.mediaUrl.slice('upload:'.length),
    );
  });

  it('uploads playable video bytes and supports seeking with HTTP ranges', async () => {
    const response = await attach(
      upload('VIDEO', 'FRIENDS'),
      WEBM,
      'video/webm',
    ).expect(201);
    const story = response.body as UploadedStory;
    expect(story.mediaType).toBe('VIDEO');
    const visible = await http()
      .get(`/api/v1/stories/${story.id}`)
      .auth(accounts[1].token, { type: 'bearer' })
      .expect(200);
    const url = (visible.body as UploadedStory).mediaUrl;
    const file = await http().get(url).expect(200);
    expect(file.headers['content-type']).toBe('video/webm');
    expect(file.body).toEqual(WEBM);
    const range = await http().get(url).set('Range', 'bytes=0-3').expect(206);
    expect(range.body).toEqual(WEBM.subarray(0, 4));
    await http().get(url).set('Range', 'bytes=99999-').expect(416);
  });

  it('revokes uploaded media immediately after audience changes and story expiry', async () => {
    const response = await attach(
      upload('IMAGE', 'CUSTOM').field(
        'customViewerIds',
        JSON.stringify([accounts[1].id]),
      ),
    ).expect(201);
    const story = response.body as UploadedStory;
    const visible = await http()
      .get(`/api/v1/stories/${story.id}`)
      .auth(accounts[1].token, { type: 'bearer' })
      .expect(200);
    const url = (visible.body as UploadedStory).mediaUrl;
    await http().get(url).expect(200);
    await http()
      .patch(`/api/v1/stories/${story.id}/visibility`)
      .auth(accounts[0].token, { type: 'bearer' })
      .send({ visibility: 'ONLY_ME' })
      .expect(200);
    await http().get(url).expect(404);
    await http()
      .patch(`/api/v1/stories/${story.id}/visibility`)
      .auth(accounts[0].token, { type: 'bearer' })
      .send({ visibility: 'PUBLIC' })
      .expect(200);
    await http().get(url).expect(200);
    await prisma.story.update({
      where: { id: story.id },
      data: {
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    await http().get(url).expect(404);
    await http().get(story.mediaUrl).expect(200); // Author retains access to their archive.
  });

  it('blocks current media access even when a viewer already has a signed URL', async () => {
    const response = await attach(upload('IMAGE', 'PUBLIC')).expect(201);
    const story = response.body as UploadedStory;
    const url = media.playbackUrl(story.id, accounts[1].id);
    await http().get(url).expect(200);
    await prisma.friendship.update({
      where: { pairKey: toPairKey(accounts[0].id, accounts[1].id) },
      data: { status: 'BLOCKED', blockedById: accounts[0].id },
    });
    await http().get(url).expect(404);
  });
});
