import { ConflictException, NotFoundException } from '@nestjs/common';
import type { GameStatus, Prisma } from '../generated/prisma/client';
import { ACTIVE_PLAYER_STATUS } from './game-capacity';
import { GAME_NOT_FOUND_MESSAGE, databaseErrorMentions } from './games.service';

export const GAME_FULL_MESSAGE = 'This game is already full.';

/**
 * Roster changes (seat, leave, remove) are allowed only while the game is recruiting or
 * cancelled; a game in progress or over keeps its roster for the lifecycle module.
 */
export const ROSTER_LOCKED_MESSAGES: Partial<Record<GameStatus, string>> = {
  ACTIVE: 'This game has already started.',
  COMPLETED: 'This game is already over.',
};

export const GAME_FACTS_SELECT = {
  id: true,
  hostId: true,
  status: true,
  requiredPlayers: true,
  gameDate: true,
  startTime: true,
} as const satisfies Prisma.GameSelect;

export type GameFacts = Prisma.GameGetPayload<{
  select: typeof GAME_FACTS_SELECT;
}>;

/**
 * Locks the Game row for the rest of the transaction, so roster changes on the same game
 * run one at a time and each sees the players committed before it.
 */
export async function lockGame(
  tx: Prisma.TransactionClient,
  gameId: string,
): Promise<GameFacts> {
  await tx.$queryRaw`SELECT "id" FROM "Game" WHERE "id" = ${gameId}::uuid FOR UPDATE`;

  const game = await tx.game.findUnique({
    where: { id: gameId },
    select: GAME_FACTS_SELECT,
  });

  if (!game) {
    throw new NotFoundException(GAME_NOT_FOUND_MESSAGE);
  }

  return game;
}

export function countSeatedPlayers(
  client: Prisma.TransactionClient,
  gameId: string,
): Promise<number> {
  return client.gameParticipant.count({
    where: { gameId, status: ACTIVE_PLAYER_STATUS },
  });
}

/**
 * The GameParticipant_capacity_guard trigger is the last line of defence against an
 * over-full game; answer it like the service's own capacity check.
 */
export async function withCapacityGuard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (
      databaseErrorMentions(error, 'GameParticipant_capacity_check') ||
      databaseErrorMentions(error, ' is full (')
    ) {
      throw new ConflictException(GAME_FULL_MESSAGE);
    }

    throw error;
  }
}
