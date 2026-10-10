import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, stat, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const UPLOAD_PREFIX = 'upload:';
const TOKEN_SECONDS = 12 * 60 * 60;
const UUID = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const FILE_NAME = new RegExp(`^${UUID}\\.(mp4|webm|jpg|png|webp|gif)$`);
const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export interface MediaUploadFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/** Private durable files; generated references never contain user-provided filenames. */
export class PrivateMediaStorage {
  readonly directory: string;

  constructor(
    private readonly config: ConfigService,
    directoryKey: string,
    private readonly resource: 'stories' | 'reels',
    private readonly endpoint: 'media' | 'video',
  ) {
    this.directory = resolve(
      config.get<string>(directoryKey) || `uploads/${resource}`,
    );
  }

  async save(
    file: MediaUploadFile | undefined,
    kind: 'IMAGE' | 'VIDEO' = 'VIDEO',
  ): Promise<string> {
    const video = kind === 'VIDEO';
    if (!file || file.size === 0)
      throw new BadRequestException(
        `Choose a ${video ? 'video' : 'photo'} to upload.`,
      );
    if (file.size > (video ? VIDEO_MAX_BYTES : PHOTO_MAX_BYTES))
      throw new BadRequestException(
        video
          ? 'Videos must be 50 MB or smaller.'
          : 'Photos must be 10 MB or smaller.',
      );
    const extension = this.extension(file);
    if (!extension || video !== ['mp4', 'webm'].includes(extension))
      throw new BadRequestException(
        video
          ? 'Choose an MP4 or WebM video.'
          : 'Choose a JPEG, PNG, WebP or GIF photo.',
      );
    await mkdir(this.directory, { recursive: true });
    const name = `${randomUUID()}.${extension}`;
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
    if (!this.isUpload(url)) throw new NotFoundException('Media not found.');
    const path = resolve(this.directory, url.slice(UPLOAD_PREFIX.length));
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException('Media not found.');
    return { path, contentType: CONTENT_TYPES[url.split('.').at(-1)!] };
  }

  async remove(url: string): Promise<void> {
    if (this.isUpload(url))
      await rm(resolve(this.directory, url.slice(UPLOAD_PREFIX.length)), {
        force: true,
      });
  }

  playbackUrl(id: string, viewerId: string): string {
    const expires = Math.floor(Date.now() / 1000) + TOKEN_SECONDS;
    const token = `${viewerId}.${expires}.${this.signature(`${id}:${viewerId}:${expires}`)}`;
    return `/api/v1/${this.resource}/${id}/${this.endpoint}?token=${token}`;
  }

  viewer(id: string, token: unknown): string {
    const invalid = () =>
      new UnauthorizedException('Media link expired. Refresh to try again.');
    if (typeof token !== 'string' || token.length > 200) throw invalid();
    const [viewerId, expiry, signature, extra] = token.split('.');
    const expected = this.signature(`${id}:${viewerId}:${expiry}`);
    if (
      !new RegExp(`^${UUID}$`).test(viewerId ?? '') ||
      !/^\d+$/.test(expiry ?? '') ||
      extra ||
      !/^[a-f0-9]{64}$/.test(signature ?? '') ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
      Number(expiry) <= Math.floor(Date.now() / 1000)
    )
      throw invalid();
    return viewerId;
  }

  private signature(payload: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(
        `${this.resource === 'reels' ? 'reel-video' : 'story-media'}:${payload}`,
      )
      .digest('hex');
  }

  private extension({ buffer: b, mimetype }: MediaUploadFile): string | null {
    if (
      mimetype === 'video/mp4' &&
      b.length >= 12 &&
      b.toString('ascii', 4, 8) === 'ftyp'
    )
      return 'mp4';
    if (
      mimetype === 'video/webm' &&
      b.length >= 4 &&
      b.readUInt32BE(0) === 0x1a45dfa3
    )
      return 'webm';
    if (
      mimetype === 'image/jpeg' &&
      b.length >= 3 &&
      b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    )
      return 'jpg';
    if (
      mimetype === 'image/png' &&
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    )
      return 'png';
    if (
      mimetype === 'image/webp' &&
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'webp';
    if (
      mimetype === 'image/gif' &&
      b.length >= 6 &&
      ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6))
    )
      return 'gif';
    return null;
  }
}
