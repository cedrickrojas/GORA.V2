import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { decodePhotoPayload } from '../common/media/photo-payload';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfilePhotoService {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, photo: string): Promise<string> {
    const { contentType, photoData } = decodePhotoPayload(photo);
    const revision = randomUUID();
    const url = `/api/v1/profiles/${userId}/photo/${revision}`;
    const result = await this.prisma.user.updateMany({
      where: { id: userId, isActive: true },
      data: { profileImageUrl: url, profilePhotoRevision: revision, profilePhotoData: photoData, profilePhotoType: contentType },
    });
    if (!result.count) throw new NotFoundException('User not found.');
    return url;
  }

  async remove(userId: string): Promise<void> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, isActive: true },
      data: { profileImageUrl: null, profilePhotoRevision: null, profilePhotoData: null, profilePhotoType: null },
    });
    if (!result.count) throw new NotFoundException('User not found.');
  }

  async read(userId: string, revision: string): Promise<{ data: Buffer; contentType: string }> {
    const photo = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true, profilePhotoRevision: revision },
      select: { profilePhotoData: true, profilePhotoType: true },
    });
    if (!photo?.profilePhotoData || !photo.profilePhotoType) throw new NotFoundException('Profile photo not found.');
    return { data: Buffer.from(photo.profilePhotoData), contentType: photo.profilePhotoType };
  }
}
