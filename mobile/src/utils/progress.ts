export function getProgressPercent(current: number, target: number): number {
  if (target <= 0) {
    return 100;
  }

  const percent = (Math.max(0, current) / target) * 100;

  return Math.min(100, Math.round(percent));
}

export function getRemaining(current: number, target: number): number {
  return Math.max(0, target - current);
}
