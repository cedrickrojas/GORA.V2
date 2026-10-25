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
import { PrismaService } from '../src/prisma/prisma.service';
import {
  REEL_VIDEO_MAX_BYTES,
  ReelVideoStorage,
} from '../src/reels/reel-video.storage';
import { toPairKey } from '../src/social/relationship';

interface Account {
  id: string;
  token: string;
}
interface UploadedReel {
  id: string;
  videoUrl: string;
  caption: string;
  durationSeconds: number;
}
// Container headers are enough for API byte/storage tests; browser QA uses a playable recording.
const WEBM = Buffer.from(
  '1a45dfa39f4286810142f7810142f2810442f381084282847765626d',
  'hex',
);
const MP4 = Buffer.from(
  '000000186674797069736f6d0000020069736f6d69736f32',
  'hex',
);

describe('Reel video uploads (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let videos: ReelVideoStorage;
  let directory: string;
  const accounts: Account[] = [];
  const http = () => request(app.getHttpServer());
  const upload = (visibility = 'ONLY_ME') =>
    http()
      .post('/api/v1/reels/upload')
      .auth(accounts[0].token, { type: 'bearer' })
      .field('visibility', visibility);
  const attach = (
    call: ReturnType<typeof upload>,
    buffer = WEBM,
    contentType = 'video/webm',
  ) =>
    call.attach('video', buffer, {
      filename: '../../unsafe-name.webm',
      contentType,
    });

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'gora-reel-upload-'));
    videos = new ReelVideoStorage(
      new ConfigService({
        JWT_SECRET: process.env.JWT_SECRET,
        REEL_UPLOAD_DIR: directory,
      }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ReelVideoStorage)
      .useValue(videos)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (const role of ['author', 'viewer']) {
      const username = `e2e_upload_${role}_${randomBytes(4).toString('hex')}`;
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
      const ids = accounts.map((account) => account.id);
      await prisma.reel.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    if (app) await app.close();
    if (directory) {
      for (const name of await readdir(directory))
        await rm(join(directory, name));
      await rmdir(directory);
    }
  });

  it('requires login, a video and valid metadata without writing files', async () => {
    await http()
      .post('/api/v1/reels/upload')
      .field('visibility', 'PUBLIC')
      .expect(401);
    await upload().expect(400);
    await attach(upload(), Buffer.from('not a movie'), 'video/mp4').expect(400);
    await attach(upload(), WEBM, 'image/png').expect(400);
    await attach(upload('INVALID')).expect(400);
    await attach(
      upload('CUSTOM').field('customViewerIds', 'broken-json'),
    ).expect(400);
    expect(await readdir(directory)).toEqual([]);
  });

  it('enforces the upload size limit', async () => {
    await attach(upload(), Buffer.alloc(REEL_VIDEO_MAX_BYTES + 1)).expect(413);
    expect(await readdir(directory)).toEqual([]);
  });

  it('removes the saved file if reel creation is rejected', async () => {
    await attach(
      upload('CUSTOM').field('customViewerIds', JSON.stringify([randomUUID()])),
    ).expect(400);
    expect(await readdir(directory)).toEqual([]);
  });

  it('saves exact bytes under a generated name and supports reload, seeking and expiration', async () => {
    const response = await attach(
      upload()
        .field('caption', ' My uploaded reel ')
        .field('durationSeconds', '12'),
    ).expect(201);
    const reel = response.body as UploadedReel;
    expect(reel.caption).toBe('My uploaded reel');
    expect(reel.durationSeconds).toBe(12);
    const row = await prisma.reel.findUniqueOrThrow({ where: { id: reel.id } });
    expect(row.videoUrl).toMatch(/^upload:[a-f0-9-]{36}\.webm$/);
    expect(
      await readFile(join(directory, row.videoUrl.slice('upload:'.length))),
    ).toEqual(WEBM);
    const reloaded = await http()
      .get(`/api/v1/reels/${reel.id}`)
      .auth(accounts[0].token, { type: 'bearer' })
      .expect(200);
    const url = (reloaded.body as UploadedReel).videoUrl;
    const full = await http().get(url).expect(200);
    expect(full.headers['content-type']).toBe('video/webm');
    expect(full.headers['cache-control']).toBe('private, no-store');
    expect(full.body).toEqual(WEBM);
    const range = await http().get(url).set('Range', 'bytes=0-3').expect(206);
    expect(range.headers['content-range']).toBe(`bytes 0-3/${WEBM.length}`);
    expect(range.body).toEqual(WEBM.subarray(0, 4));
    await http().get(url).set('Range', 'bytes=9999-').expect(416);
    await http().get(`/api/v1/reels/${reel.id}/video`).expect(401);
    await http().get(`${url}x`).expect(401);
    await http().get(url.replace(reel.id, randomUUID())).expect(401);
    const oldClock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() - 13 * 60 * 60 * 1000);
    const expired = videos.playbackUrl(reel.id, accounts[0].id);
    oldClock.mockRestore();
    await http().get(expired).expect(401);
    await http().get(videos.playbackUrl(reel.id, accounts[1].id)).expect(404);
    await http()
      .delete(`/api/v1/reels/${reel.id}`)
      .auth(accounts[0].token, { type: 'bearer' })
      .expect(200);
    await http().get(url).expect(404);
  });

  it('handles MP4 and custom viewers, and revokes playback when the audience changes', async () => {
    const response = await attach(
      upload('CUSTOM').field(
        'customViewerIds',
        JSON.stringify([accounts[1].id]),
      ),
      MP4,
      'video/mp4',
    ).expect(201);
    const reel = response.body as UploadedReel;
    const visible = await http()
      .get(`/api/v1/reels/${reel.id}`)
      .auth(accounts[1].token, { type: 'bearer' })
      .expect(200);
    const url = (visible.body as UploadedReel).videoUrl;
    expect((await http().get(url).expect(200)).headers['content-type']).toBe(
      'video/mp4',
    );
    await http()
      .patch(`/api/v1/reels/${reel.id}/visibility`)
      .auth(accounts[0].token, { type: 'bearer' })
      .send({ visibility: 'ONLY_ME' })
      .expect(200);
    await http().get(url).expect(404);
  });
});
