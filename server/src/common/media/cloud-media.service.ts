import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BlobGateway } from './blob.gateway';
import { MEDIA_TYPES, type StartMediaUploadDto } from './cloud-media.dto';
import {
  PHOTO_MAX_BYTES,
  mediaExtension,
  type MediaUploadFile,
} from './private-media.storage';

const REF = /^blob:([a-f0-9-]{36})\.(jpg|png|webp|gif|mp4|webm)$/;
const TTL = 15 * 60 * 1000;
export type MediaResource = 'stories' | 'reels';

@Injectable()
export class CloudMediaService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly blobs: BlobGateway,
  ) {}

  provider(): 'blob' | 'local' {
    if (this.config.get<string>('BLOB_READ_WRITE_TOKEN')) return 'blob';
    if (this.config.get<string>('VERCEL'))
      throw new ServiceUnavailableException(
        'Media storage is not configured. Contact GORA support.',
      );
    return 'local';
  }
  private enabled() {
    if (this.provider() !== 'blob')
      throw new ServiceUnavailableException(
        'Cloud media storage is not configured.',
      );
  }
  private path(
    resource: MediaResource,
    id: string,
    contentType: keyof typeof MEDIA_TYPES,
  ) {
    return `gora/${resource}/${id}.${MEDIA_TYPES[contentType]}`;
  }
  private referencePath(resource: MediaResource, reference: string) {
    const match = REF.exec(reference);
    if (!match) throw new NotFoundException('Media not found.');
    return `gora/${resource}/${match[1]}.${match[2]}`;
  }
  async start(userId: string, dto: StartMediaUploadDto) {
    this.enabled();
    const video = dto.contentType.startsWith('video/');
    if (
      (!video && dto.resource === 'reels') ||
      (!video && dto.size > PHOTO_MAX_BYTES)
    )
      throw new BadRequestException(
        video
          ? 'Choose an MP4 or WebM video.'
          : 'Photos must be 10 MB or smaller. Reels require video.',
      );
    const active = await this.prisma.cloudMediaUpload.count({
      where: { userId, claimedAt: null, expiresAt: { gt: new Date() } },
    });
    if (active >= 5)
      throw new ConflictException(
        'Too many unfinished uploads. Cancel an upload or try again in 15 minutes.',
      );
    const id = randomUUID(),
      expiresAt = new Date(Date.now() + TTL);
    const pathname = this.path(dto.resource, id, dto.contentType);
    const clientToken = await this.blobs.mint(
      pathname,
      dto.contentType,
      dto.size,
      expiresAt.getTime(),
    );
    await this.prisma.cloudMediaUpload.create({
      data: { id, userId, ...dto, expiresAt },
    });
    return {
      uploadId: id,
      pathname,
      clientToken,
      expiresAt: expiresAt.toISOString(),
    };
  }
  /** Compatibility for multipart pages opened before direct cloud uploads shipped.
   * New clients continue to upload directly, including files over the Function limit.
   */
  async saveFile(
    userId: string,
    resource: MediaResource,
    file: MediaUploadFile,
    extension: string,
  ): Promise<string> {
    this.enabled();
    const id = randomUUID(),
      pathname = `gora/${resource}/${id}.${extension}`;
    try {
      await this.blobs.put(pathname, file);
      await this.prisma.cloudMediaUpload.create({
        data: {
          id,
          userId,
          resource,
          contentType: file.mimetype,
          size: file.size,
          expiresAt: new Date(Date.now() + TTL),
          claimedAt: new Date(),
        },
      });
    } catch (error) {
      await this.blobs.remove(pathname).catch(() => undefined);
      throw error;
    }
    return `blob:${id}.${extension}`;
  }
  async complete<T>(
    userId: string,
    id: string,
    resource: MediaResource,
    kind: 'IMAGE' | 'VIDEO',
    create: (reference: string, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    this.enabled();
    const upload = await this.prisma.cloudMediaUpload.findFirst({
      where: {
        id,
        userId,
        resource,
        claimedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!upload)
      throw new NotFoundException(
        'Upload expired or unavailable. Choose your file again.',
      );
    const contentType = upload.contentType as keyof typeof MEDIA_TYPES;
    if ((kind === 'VIDEO') !== contentType.startsWith('video/'))
      throw new BadRequestException(
        'The uploaded file does not match its media type.',
      );
    const pathname = this.path(resource, id, contentType);
    const metadata = await this.blobs.head(pathname);
    if (
      !new URL(metadata.url).hostname.endsWith(
        '.private.blob.vercel-storage.com',
      )
    )
      throw new ServiceUnavailableException(
        'GORA uploads require a private Blob store.',
      );
    if (metadata.size !== upload.size || metadata.contentType !== contentType)
      throw new BadRequestException(
        'Uploaded media is incomplete or has an invalid type.',
      );
    const data = await this.blobs.get(pathname, 'bytes=0-63');
    if (!data || data.statusCode !== 200)
      throw new BadRequestException('Uploaded file not found.');
    const reader = data.stream.getReader();
    const chunks: Buffer[] = [];
    let received = 0;
    try {
      while (received < 64) {
        const part = await reader.read();
        if (part.done) break;
        const chunk = Buffer.from(part.value).subarray(0, 64 - received);
        chunks.push(chunk);
        received += chunk.length;
      }
    } finally {
      await reader.cancel();
    }
    const header = Buffer.concat(chunks);
    if (
      mediaExtension({
        buffer: header,
        mimetype: contentType,
        size: metadata.size,
      }) !== MEDIA_TYPES[contentType]
    )
      throw new BadRequestException(
        'This file is not a supported photo or video.',
      );
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.cloudMediaUpload.updateMany({
        where: { id, userId, claimedAt: null, expiresAt: { gt: new Date() } },
        data: { claimedAt: new Date() },
      });
      if (!claimed.count)
        throw new ConflictException('This upload has already been shared.');
      return create(`blob:${id}.${MEDIA_TYPES[contentType]}`, tx);
    });
  }
  async cancel(userId: string, id: string): Promise<void> {
    // Deleting only an unclaimed ticket cannot remove a successfully shared story,
    // even if the client's completion response was interrupted or retried.
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        resource: MediaResource;
        contentType: keyof typeof MEDIA_TYPES;
      }[]
    >`
      DELETE FROM "CloudMediaUpload" WHERE "id"=${id}::uuid AND "userId"=${userId}::uuid AND "claimedAt" IS NULL
      RETURNING "id","resource","contentType"`;
    for (const row of rows)
      await this.blobs.remove(this.path(row.resource, row.id, row.contentType));
  }
  async remove(resource: MediaResource, reference: string): Promise<void> {
    await this.blobs.remove(this.referencePath(resource, reference));
    await this.prisma.cloudMediaUpload.deleteMany({
      where: { id: REF.exec(reference)![1], resource },
    });
  }
  async send(
    response: Response,
    resource: MediaResource,
    reference: string,
  ): Promise<void> {
    const pathname = this.referencePath(resource, reference);
    const meta = await this.blobs.head(pathname);
    const size = meta.size,
      range = response.req.headers.range;
    let start = 0,
      end = size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        response.status(416).set('Content-Range', `bytes */${size}`).end();
        return;
      }
      start = match[1]
        ? Number(match[1])
        : Math.max(0, size - Number(match[2]));
      end =
        match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= size
      ) {
        response.status(416).set('Content-Range', `bytes */${size}`).end();
        return;
      }
    }
    const data = await this.blobs.get(
      pathname,
      range ? `bytes=${start}-${end}` : undefined,
    );
    if (!data || data.statusCode !== 200)
      throw new NotFoundException('Media not found.');
    if (
      range &&
      data.headers.get('content-range') !== `bytes ${start}-${end}/${size}`
    ) {
      await data.stream.cancel();
      throw new ServiceUnavailableException(
        'Video seeking is temporarily unavailable.',
      );
    }
    response.status(range ? 206 : 200).set({
      'Content-Type': meta.contentType,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    });
    try {
      await pipeline(
        Readable.fromWeb(
          data.stream as import('node:stream/web').ReadableStream,
        ),
        response,
      );
    } catch (error) {
      if (!response.destroyed) throw error;
    }
  }
}
