import {
  basketballOutline,
  bicycleOutline,
  footballOutline,
  medalOutline,
  tennisballOutline,
  walkOutline,
  waterOutline,
} from 'ionicons/icons';

export interface SportVisual {
  icon: string;
  /** CSS background value; kept as a solid surface for the GORA theme. */
  gradient: string;
}

const DEFAULT_VISUAL: SportVisual = {
  icon: medalOutline,
  gradient: 'var(--gora-surface-raised)',
};

const SPORT_VISUALS: Record<string, SportVisual> = {
  basketball: {
    icon: basketballOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  volleyball: {
    icon: medalOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  football: {
    icon: footballOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  tennis: {
    icon: tennisballOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  badminton: {
    icon: tennisballOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  pickleball: {
    icon: tennisballOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  running: {
    icon: walkOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  swimming: {
    icon: waterOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  'table tennis': {
    icon: tennisballOutline,
    gradient: 'var(--gora-surface-raised)',
  },
  cycling: {
    icon: bicycleOutline,
    gradient: 'var(--gora-surface-raised)',
  },
};

export function getSportVisual(sport: string): SportVisual {
  return SPORT_VISUALS[sport.toLowerCase()] ?? DEFAULT_VISUAL;
}

const SPORT_MARKERS: Record<string, string> = {
  basketball: '🏀',
  volleyball: '🏐',
  football: '⚽',
  tennis: '🎾',
  badminton: '🏸',
  running: '🏃',
  cycling: '🚴',
  swimming: '🏊',
  'table tennis': '🏓',
  pickleball: '🥒',
  other: '🏅',
};

/** The map marker for a sport's games. */
export function getSportMarker(sport: string): string {
  return SPORT_MARKERS[sport.toLowerCase()] ?? '📍';
}

/** "Table Tennis" -> "table-tennis", used in /search/:sport. */
export function toSportSlug(sport: string): string {
  return sport.trim().toLowerCase().replace(/\s+/g, '-');
}
