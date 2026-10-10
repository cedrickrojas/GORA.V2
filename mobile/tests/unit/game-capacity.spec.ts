import { describe, expect, test } from 'vitest';
import { buildMockGames } from '@/services/mock/mock-catalog';
import { buildMockGameDetails } from '@/services/mock/mock-rosters';
import {
  buildRosterSlots,
  countOccupyingPlayers,
  formatPlayerCount,
  summarizeGameCapacity,
} from '@/utils/games';

const NOW = Date.parse('2026-09-29T12:00:00.000Z');

describe('game capacity', () => {
  test('counts only occupying participant statuses', () => {
    expect(countOccupyingPlayers(['ACTIVE', 'COMPLETED', 'LEFT', 'REMOVED'])).toBe(2);
  });

  test.each([
    [0, '0/12', 12, false],
    [1, '1/12', 11, false],
    [3, '3/12', 9, false],
    [8, '8/12', 4, false],
    [11, '11/12', 1, false],
    [12, '12/12', 0, true],
    [13, '12/12', 0, true],
  ])('summarizes %s occupying players as %s', (occupied, label, remaining, isFull) => {
    const summary = summarizeGameCapacity(12, occupied);

    expect(formatPlayerCount(summary)).toBe(label);
    expect(summary.remainingSlots).toBe(remaining);
    expect(summary.isFull).toBe(isFull);
  });

  test('Riverside evening volleyball is PLAYERS 3/12 from occupant count', () => {
    const game = buildMockGames(NOW).find((candidate) => candidate.id === 'game-volley-riverside-evening');

    expect(game).toBeDefined();
    expect(formatPlayerCount(game!)).toBe('3/12');
    expect(game!.status).toBe('OPEN');
  });

  test('a full roster becomes FULL and never shows 13/12', () => {
    const game = buildMockGames(NOW).find((candidate) => candidate.id === 'game-tennis-full');

    expect(formatPlayerCount(game!)).toBe('4/4');
    expect(game!.status).toBe('FULL');
    expect(formatPlayerCount(summarizeGameCapacity(12, 13))).toBe('12/12');
  });

  test('the roster lists accepted players then open slots', () => {
    const game = buildMockGames(NOW).find((candidate) => candidate.id === 'game-volley-riverside-evening')!;
    const details = buildMockGameDetails(game);
    const slots = buildRosterSlots(details.requiredPlayers, details.players);

    expect(details.currentPlayers).toBe(3);
    expect(details.remainingSlots).toBe(9);
    expect(details.players).toHaveLength(3);
    expect(details.players[0]?.isHost).toBe(true);
    expect(slots).toHaveLength(12);
    expect(slots.slice(0, 3).every((slot) => slot.player)).toBe(true);
    expect(slots.slice(3).every((slot) => slot.player === null)).toBe(true);
    expect(slots[0]?.label).toBe('01');
    expect(slots[11]?.label).toBe('12');
  });

  test('the host is not on the roster unless they joined as a player', () => {
    const playing = buildMockGameDetails(
      buildMockGames(NOW).find((candidate) => candidate.id === 'game-volley-riverside-evening')!,
    );
    const organizing = buildMockGameDetails(
      buildMockGames(NOW).find((candidate) => candidate.id === 'game-volley-riverside-late')!,
    );

    expect(playing.players.some((player) => player.isHost)).toBe(true);
    expect(organizing.players.some((player) => player.isHost)).toBe(false);
    expect(organizing.players.some((player) => player.user.id === organizing.host.id)).toBe(false);
  });
});
