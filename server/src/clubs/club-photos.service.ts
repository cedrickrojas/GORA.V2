import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import { decodePhotoPayload } from '../common/media/photo-payload';
import { PrismaService } from '../prisma/prisma.service';

interface ClubPhotoInput {
  profilePhoto?: string | null;
  coverPhoto?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
}

@Injectable()
export class ClubPhotosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Called only inside the authorized club create/update transaction. */
  async apply(
    tx: Prisma.TransactionClient,
    clubId: string,
    input: ClubPhotoInput,
  ): Promise<void> {
    for (const kind of ['profile', 'cover'] as const) {
      const photo = kind === 'profile' ? input.profilePhoto : input.coverPhoto;
      const urlField = kind === 'profile' ? 'profileImageUrl' : 'coverImageUrl';
      const url = input[urlField];
      if (photo === undefined) {
        // A legacy URL replacement/removal invalidates any previously uploaded file.
        if (url !== undefined)
          await tx.clubPhoto.deleteMany({ where: { clubId, kind } });
        continue;
      }
      if (photo !== null && url != null)
        throw new BadRequestException(
          'Choose a photo upload or a URL, not both.',
        );
      if (photo === null) {
        await tx.clubPhoto.deleteMany({ where: { clubId, kind } });
        await tx.club.update({
          where: { id: clubId },
          data: { [urlField]: null },
        });
        continue;
      }
      const { contentType, photoData } = decodePhotoPayload(photo);
      const revision = randomUUID();
      await tx.clubPhoto.upsert({
        where: { clubId_kind: { clubId, kind } },
        create: { clubId, kind, revision, contentType, data: photoData },
        update: { revision, contentType, data: photoData },
      });
      await tx.club.update({
        where: { id: clubId },
        data: {
          [urlField]: `/api/v1/clubs/${clubId}/photos/${kind}/${revision}`,
        },
      });
    }
  }

  async read(clubId: string, kind: string, revision: string) {
    if (kind !== 'profile' && kind !== 'cover')
      throw new NotFoundException('Club photo not found.');
    const photo = await this.prisma.clubPhoto.findFirst({
      where: { clubId, kind, revision, club: { isActive: true } },
      select: { data: true, contentType: true },
    });
    if (!photo) throw new NotFoundException('Club photo not found.');
    return { data: Buffer.from(photo.data), contentType: photo.contentType };
  }
}
