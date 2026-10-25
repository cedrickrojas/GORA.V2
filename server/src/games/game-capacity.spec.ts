import {
  canAcceptAnotherPlayer,
  countActivePlayers,
  summarizeGameCapacity,
} from './game-capacity';

describe('game capacity', () => {
  it('counts only ACTIVE rows as current players', () => {
    expect(
      countActivePlayers(['ACTIVE', 'ACTIVE', 'COMPLETED', 'LEFT', 'REMOVED']),
    ).toBe(2);
  });

  it('does not count the host unless they have an ACTIVE row', () => {
    const participantStatuses: string[] = [];

    expect(
      summarizeGameCapacity(12, countActivePlayers(participantStatuses)),
    ).toEqual({
      requiredPlayers: 12,
      currentPlayers: 0,
      remainingSlots: 12,
      recruitingStatus: 'OPEN',
    });
  });

  it('counts the host when they explicitly joined', () => {
    expect(summarizeGameCapacity(12, countActivePlayers(['ACTIVE']))).toEqual({
      requiredPlayers: 12,
      currentPlayers: 1,
      remainingSlots: 11,
      recruitingStatus: 'OPEN',
    });
  });

  it.each([
    [0, '0/12', 'OPEN', 12],
    [1, '1/12', 'OPEN', 11],
    [3, '3/12', 'OPEN', 9],
    [8, '8/12', 'OPEN', 4],
    [11, '11/12', 'OPEN', 1],
    [12, '12/12', 'FULL', 0],
  ])(
    'summarizes %s active players on a 12-slot game',
    (active, label, status, remaining) => {
      const summary = summarizeGameCapacity(12, active);

      expect(`${summary.currentPlayers}/${summary.requiredPlayers}`).toBe(
        label,
      );
      expect(summary.recruitingStatus).toBe(status);
      expect(summary.remainingSlots).toBe(remaining);
    },
  );

  it('never reports 13/12 and rejects the extra player', () => {
    const summary = summarizeGameCapacity(12, 13);

    expect(`${summary.currentPlayers}/${summary.requiredPlayers}`).toBe(
      '12/12',
    );
    expect(summary.recruitingStatus).toBe('FULL');
    expect(canAcceptAnotherPlayer(12, 11)).toBe(true);
    expect(canAcceptAnotherPlayer(12, 12)).toBe(false);
  });
});
