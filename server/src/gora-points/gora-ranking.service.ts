import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatDisplayName } from '../users/display-name';
import type { GoraRankingQuery } from './gora-ranking.dto';

interface RankedPlayer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  goraPoints: number;
  rank: number;
}

interface RankingSnapshot {
  players: RankedPlayer[];
  currentPlayer: RankedPlayer | null;
  total: number;
}

@Injectable()
export class GoraRankingService {
  constructor(private readonly prisma: PrismaService) {}

  async list(viewerId: string, { limit, offset }: GoraRankingQuery) {
    // One statement gives the page, own rank and count the same database snapshot.
    // Rank depends only on points (competition ranking: 1, 1, 3); usernames
    // provide a stable page order without breaking ties. Never return private fields.
    const [snapshot] = await this.prisma.$queryRaw<RankingSnapshot[]>`
      WITH ranked AS (
        SELECT u.id, u.username, u."firstName", u."lastName", u."profileImageUrl",
               u."goraPoints", (RANK() OVER (ORDER BY u."goraPoints" DESC))::int AS rank
        FROM "User" u
        WHERE u."isActive" = true AND u.role = 'USER'
          AND NOT EXISTS (
            SELECT 1 FROM "Friendship" f
            WHERE f.status = 'BLOCKED'
              AND ((f."requesterId" = ${viewerId}::uuid AND f."receiverId" = u.id)
                OR (f."receiverId" = ${viewerId}::uuid AND f."requesterId" = u.id))
          )
      ), page AS (
        SELECT * FROM ranked
        ORDER BY "goraPoints" DESC, username ASC, id ASC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT COALESCE(
               (SELECT jsonb_agg(to_jsonb(p) ORDER BY p."goraPoints" DESC, p.username, p.id) FROM page p),
               '[]'::jsonb
             ) AS players,
             (SELECT to_jsonb(me) FROM ranked me WHERE me.id = ${viewerId}::uuid) AS "currentPlayer",
             (SELECT count(*)::int FROM ranked) AS total
    `;
    const present = (player: RankedPlayer) => ({
      id: player.id,
      username: player.username,
      displayName: formatDisplayName(player),
      avatarUrl: player.profileImageUrl,
      goraPoints: player.goraPoints,
      rank: player.rank,
    });
    const nextOffset = offset + snapshot.players.length;
    return {
      players: snapshot.players.map(present),
      currentPlayer: snapshot.currentPlayer
        ? present(snapshot.currentPlayer)
        : null,
      total: snapshot.total,
      nextOffset,
      hasMore: nextOffset < snapshot.total,
    };
  }
}
