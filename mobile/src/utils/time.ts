export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export function formatTimeAgo(timestampMs: number, nowMs: number): string {
  const elapsed = Math.round(Math.max(0, nowMs - timestampMs) / MINUTE_MS) * MINUTE_MS;

  if (elapsed < MINUTE_MS) {
    return 'just now';
  }

  if (elapsed < HOUR_MS) {
    return `${elapsed / MINUTE_MS}m ago`;
  }

  if (elapsed < DAY_MS) {
    return `${Math.floor(elapsed / HOUR_MS)}h ago`;
  }

  return `${Math.floor(elapsed / DAY_MS)}d ago`;
}

export function formatTimeLeft(remainingMs: number): string {
  if (remainingMs < HOUR_MS) {
    return `${Math.max(1, Math.ceil(remainingMs / MINUTE_MS))}m left`;
  }

  return `${Math.floor(remainingMs / HOUR_MS)}h left`;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function formatStartTime(startsAtMs: number, nowMs: number): string {
  const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(startsAtMs);
  const startDay = new Date(startsAtMs).setHours(0, 0, 0, 0);
  const today = new Date(nowMs).setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startDay - today) / DAY_MS);

  if (dayDiff === 0) {
    return `Today, ${time}`;
  }

  if (dayDiff === 1) {
    return `Tomorrow, ${time}`;
  }

  const day = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(startsAtMs);

  return `${day}, ${time}`;
}

export function formatDistanceKm(distanceKm: number): string {
  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm)} km`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value);
}
