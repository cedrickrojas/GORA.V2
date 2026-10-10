import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveRelationship,
  toPairKey,
  type RelationshipState,
} from './relationship';

@Injectable()
export class RelationshipService {
  constructor(private readonly prisma: PrismaService) {}

  async between(
    viewerId: string,
    targetId: string,
  ): Promise<RelationshipState> {
    if (viewerId === targetId) {
      return 'SELF';
    }

    const friendship = await this.prisma.friendship.findUnique({
      where: { pairKey: toPairKey(viewerId, targetId) },
      select: {
        requesterId: true,
        receiverId: true,
        status: true,
        blockedById: true,
      },
    });

    return resolveRelationship(viewerId, targetId, friendship);
  }

  /** Ids (from the given list) that have a block with the user in either direction. */
  async blockedAmong(userId: string, otherIds: string[]): Promise<string[]> {
    if (otherIds.length === 0) {
      return [];
    }

    const blocks = await this.prisma.friendship.findMany({
      where: {
        status: 'BLOCKED',
        pairKey: { in: otherIds.map((otherId) => toPairKey(userId, otherId)) },
      },
      select: { requesterId: true, receiverId: true },
    });

    return blocks.map((block) =>
      block.requesterId === userId ? block.receiverId : block.requesterId,
    );
  }
}
