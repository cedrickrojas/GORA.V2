import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { visiblePostsWhere } from './post-visibility';
import { decodePhotoPayload } from '../common/media/photo-payload';

/** Bounded photos live with the post in PostgreSQL, including on serverless hosts. */
@Injectable()
export class PostPhotosService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  decode(dataUrl: string, sortOrder: number) {
    return {
      mediaType: 'IMAGE' as const,
      mediaUrl: 'postgres:photo',
      ...decodePhotoPayload(dataUrl),
      sortOrder,
    };
  }

  url(postId: string, mediaId: string, viewerId: string): string {
    const expires = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
    const signature = this.sign(`${postId}:${mediaId}:${viewerId}:${expires}`);
    return `/api/v1/posts/${postId}/media/${mediaId}?token=${viewerId}.${expires}.${signature}`;
  }

  async read(postId: string, mediaId: string, token: unknown) {
    const invalid = () =>
      new UnauthorizedException('Photo link expired. Refresh to try again.');
    if (typeof token !== 'string' || token.length > 200) throw invalid();
    const match = /^([a-f0-9-]{36})\.(\d{10})\.([a-f0-9]{64})$/.exec(token);
    if (!match) throw invalid();
    const [, viewerId, expiry, signature] = match;
    const expected = this.sign(`${postId}:${mediaId}:${viewerId}:${expiry}`);
    if (
      Number(expiry) <= Math.floor(Date.now() / 1000) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      throw invalid();
    if (!(await this.users.findActiveById(viewerId)))
      throw new NotFoundException('Photo not found.');
    const photo = await this.prisma.postMedia.findFirst({
      where: { id: mediaId, postId, post: visiblePostsWhere(viewerId) },
      select: { photoData: true, contentType: true },
    });
    if (!photo?.photoData || !photo.contentType)
      throw new NotFoundException('Photo not found.');
    return {
      data: Buffer.from(photo.photoData),
      contentType: photo.contentType,
    };
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`post-photo:${payload}`)
      .digest('hex');
  }
}
