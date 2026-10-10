import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, stat, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

export const REEL_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const UPLOAD_PREFIX = 'upload:';
const VIDEO_TOKEN_SECONDS = 12 * 60 * 60;
const FILE_NAME = /^[a-f0-9-]{36}\.(mp4|webm)$/;

export interface ReelVideoFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** Files stay outside the public web root. Playback requires a scoped, expiring URL. */
@Injectable()
export class ReelVideoStorage {
  readonly directory: string;

  constructor(private readonly config: ConfigService) {
    this.directory = resolve(
      config.get<string>('REEL_UPLOAD_DIR') || 'uploads/reels',
    );
  }

  async save(file: ReelVideoFile | undefined): Promise<string> {
    if (!file || file.size === 0)
      throw new BadRequestException('Choose a video to upload.');
    if (file.size > REEL_VIDEO_MAX_BYTES)
      throw new BadRequestException('Videos must be 50 MB or smaller.');
    const mp4 =
      file.mimetype === 'video/mp4' &&
      file.buffer.length >= 12 &&
      file.buffer.toString('ascii', 4, 8) === 'ftyp';
    const webm =
      file.mimetype === 'video/webm' &&
      file.buffer.length >= 4 &&
      file.buffer.readUInt32BE(0) === 0x1a45dfa3;
    if (!mp4 && !webm)
      throw new BadRequestException('Choose an MP4 or WebM video.');
    await mkdir(this.directory, { recursive: true });
    const name = `${randomUUID()}.${mp4 ? 'mp4' : 'webm'}`;
    const path = resolve(this.directory, name);
    try {
      await writeFile(path, file.buffer, { flag: 'wx' });
    } catch (error) {
      await rm(path, { force: true }).catch(() => undefined);
      throw error;
    }
    return `${UPLOAD_PREFIX}${name}`;
  }

  isUpload(url: string): boolean {
    return (
      url.startsWith(UPLOAD_PREFIX) &&
      FILE_NAME.test(url.slice(UPLOAD_PREFIX.length))
    );
  }

  async file(url: string): Promise<{ path: string; contentType: string }> {
    if (!this.isUpload(url)) throw new NotFoundException('Video not found.');
    const path = resolve(this.directory, url.slice(UPLOAD_PREFIX.length));
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException('Video not found.');
    return {
      path,
      contentType: url.endsWith('.mp4') ? 'video/mp4' : 'video/webm',
    };
  }

  async remove(url: string): Promise<void> {
    if (this.isUpload(url))
      await rm(resolve(this.directory, url.slice(UPLOAD_PREFIX.length)), {
        force: true,
      });
  }

  playbackUrl(reelId: string, viewerId: string): string {
    const expires = Math.floor(Date.now() / 1000) + VIDEO_TOKEN_SECONDS;
    const payload = `${reelId}:${viewerId}:${expires}`;
    const token = `${viewerId}.${expires}.${this.signature(payload)}`;
    return `/api/v1/reels/${reelId}/video?token=${token}`;
  }

  viewer(reelId: string, token: unknown): string {
    if (typeof token !== 'string' || token.length > 200)
      throw new UnauthorizedException(
        'Video link expired. Refresh to try again.',
      );
    const [viewerId, expiry, signature, extra] = token.split('.');
    const expected = this.signature(`${reelId}:${viewerId}:${expiry}`);
    if (
      !viewerId ||
      !/^\d+$/.test(expiry ?? '') ||
      extra ||
      !/^[a-f0-9]{64}$/.test(signature ?? '') ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
      Number(expiry) <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException(
        'Video link expired. Refresh to try again.',
      );
    }
    return viewerId;
  }

  private signature(payload: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`reel-video:${payload}`)
      .digest('hex');
  }
}
