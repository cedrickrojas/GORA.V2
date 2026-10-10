import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { decodePhotoPayload } from '../common/media/photo-payload';
import { PrismaService } from '../prisma/prisma.service';
import { RelationshipService } from '../social/relationship.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ProfileCoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly relationships: RelationshipService,
  ) {}

  async save(userId: string, photo: string): Promise<void> {
    const { contentType, photoData } = decodePhotoPayload(photo);
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, isActive: true },
      data: {
        coverImageUrl: null,
        coverPhotoRevision: randomUUID(),
        coverPhotoData: photoData,
        coverPhotoType: contentType,
      },
    });
    if (!count) throw new NotFoundException('User not found.');
  }

  async remove(userId: string): Promise<void> {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, isActive: true },
      data: {
        coverImageUrl: null,
        coverPhotoRevision: null,
        coverPhotoData: null,
        coverPhotoType: null,
      },
    });
    if (!count) throw new NotFoundException('User not found.');
  }

  url(
    reference: string | null,
    revision: string | null,
    userId: string,
    viewerId: string,
  ): string | null {
    if (!revision) return reference;
    const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
    return `/api/v1/profiles/${userId}/cover/${revision}?token=${viewerId}.${expiry}.${this.sign(`${userId}:${revision}:${viewerId}:${expiry}`)}`;
  }

  async read(userId: string, revision: string, token: unknown) {
    const invalid = () =>
      new UnauthorizedException('Cover link expired. Refresh to try again.');
    if (typeof token !== 'string' || token.length > 200) throw invalid();
    const match = /^([a-f0-9-]{36})\.(\d{10})\.([a-f0-9]{64})$/.exec(token);
    if (!match) throw invalid();
    const [, viewerId, expiry, signature] = match;
    if (
      Number(expiry) <= Math.floor(Date.now() / 1000) ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(this.sign(`${userId}:${revision}:${viewerId}:${expiry}`)),
      )
    )
      throw invalid();
    if (
      !(await this.users.findActiveById(viewerId)) ||
      (await this.relationships.between(viewerId, userId)) === 'BLOCKED_BY_THEM'
    )
      throw new NotFoundException('Cover photo not found.');
    const cover = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, coverPhotoRevision: revision },
      select: { coverPhotoData: true, coverPhotoType: true },
    });
    if (!cover?.coverPhotoData || !cover.coverPhotoType)
      throw new NotFoundException('Cover photo not found.');
    return {
      data: Buffer.from(cover.coverPhotoData),
      contentType: cover.coverPhotoType,
    };
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`profile-cover:${payload}`)
      .digest('hex');
  }
}
