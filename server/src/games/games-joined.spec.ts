import { ConfigService } from '@nestjs/config';
import type { ParticipantStatus } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { GamesService } from './games.service';
import { visibleGamesWhere } from './game-visibility';

describe('joined game history', () => {
  const viewerId = 'player';
  const timestamp = new Date('2026-10-30T00:00:00Z');
  const findMany = jest.fn();
  const service = new GamesService(
    { game: { findMany } } as unknown as PrismaService,
    new ConfigService({ GAME_TIMEZONE: 'Asia/Manila' }),
  );

  beforeEach(() => findMany.mockReset());

  function row(participationStatus: ParticipantStatus | null) {
    return {
      id: 'game',
      hostId: 'host',
      sportId: 'sport',
      clubId: null,
      title: 'Pickup',
      description: null,
      requiredPlayers: 12,
      gameDate: new Date('2026-11-02T00:00:00Z'),
      startTime: new Date('2026-11-02T18:00:00Z'),
      endTime: null,
      locationName: 'Court',
      latitude: null,
      longitude: null,
      status: 'OPEN',
      createdAt: timestamp,
      updatedAt: timestamp,
      sport: { id: 'sport', name: 'Basketball', iconUrl: null },
      host: {
        id: 'host',
        username: 'host',
        firstName: 'Game',
        lastName: 'Host',
        profileImageUrl: null,
      },
      club: null,
      _count: { participants: 3, joinRequests: 2 },
      participants: participationStatus
        ? [{ id: 'seat', status: participationStatus, joinedAt: timestamp }]
        : [],
      joinRequests: [
        {
          status: participationStatus ? 'ACCEPTED' : 'PENDING',
          createdAt: timestamp,
        },
      ],
    };
  }

  it.each(['ACTIVE', 'LEFT', 'REMOVED', 'COMPLETED', null] as const)(
    'retains %s participation without treating historical seats as current players',
    async (status) => {
      findMany.mockResolvedValue([row(status)]);
      const history = await service.listJoined(viewerId);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        participationStatus: status,
        isPlayer: status === 'ACTIVE',
        currentPlayers: 3,
        pendingRequestCount: null,
        canEdit: false,
        canCancel: false,
        joinedAt: status ? timestamp.toISOString() : null,
        requestedAt: timestamp.toISOString(),
      });
    },
  );

  it('keeps a cancelled request even when there is no participant row', async () => {
    const game = row(null);
    game.joinRequests[0].status = 'CANCELLED';
    findMany.mockResolvedValue([game]);
    expect((await service.listJoined(viewerId))[0]).toMatchObject({
      joinRequestStatus: 'CANCELLED',
      participationStatus: null,
      isPlayer: false,
    });
  });

  it('limits history to the signed-in viewer and preserves game visibility rules', async () => {
    findMany.mockResolvedValue([]);
    await service.listJoined(viewerId);
    const query = findMany.mock.calls[0][0] as {
      where: { AND: unknown[] };
      select: {
        participants: { where: unknown };
        joinRequests: { where: unknown };
      };
    };
    expect(query.where.AND).toEqual(
      expect.arrayContaining([
        visibleGamesWhere(viewerId),
        { hostId: { not: viewerId } },
        {
          OR: [
            { participants: { some: { userId: viewerId } } },
            { joinRequests: { some: { userId: viewerId } } },
          ],
        },
      ]),
    );
    expect(query.select.participants.where).toEqual({ userId: viewerId });
    expect(query.select.joinRequests.where).toEqual({ userId: viewerId });
  });
});
