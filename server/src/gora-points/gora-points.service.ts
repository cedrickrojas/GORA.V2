import { Injectable } from '@nestjs/common';
import type { GoraPointReason } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoraPointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Each source event can award points only once, even when a request is retried. */
  async award(userId: string, reason: GoraPointReason, sourceKey: string, points: number): Promise<boolean> {
    return this.prisma.$transaction((tx) => this.awardInTransaction(tx, userId, reason, sourceKey, points));
  }

  async awardInTransaction(tx: Prisma.TransactionClient, userId: string, reason: GoraPointReason, sourceKey: string, points: number): Promise<boolean> {
    const inserted = await tx.goraPointEvent.createMany({
      data: [{ userId, reason, sourceKey, points }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return false;
    await tx.user.update({ where: { id: userId }, data: { goraPoints: { increment: points } } });
    return true;
  }
}
