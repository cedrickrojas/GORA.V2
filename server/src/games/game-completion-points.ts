/** Successful-game reward scales with the number of players required, capped at 3. */
export function successfulGamePoints(requiredPlayers: number): number {
  if (requiredPlayers <= 2) return 1;
  if (requiredPlayers === 3) return 2;
  return 3;
}
