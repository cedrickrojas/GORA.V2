import {
  basketballOutline,
  bicycleOutline,
  footballOutline,
  gameControllerOutline,
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
  esports: {
    icon: gameControllerOutline,
    gradient: 'var(--gora-surface-raised)',
  },
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

const SPORT_IMAGES: Record<string, string> = {
  basketball: '/images/basketball-action.png',
  volleyball: '/images/volleyball-action.png',
  football: '/images/football-action.png',
  tennis: '/images/tennis-action.png',
  badminton: '/images/badminton-action.png',
  pickleball: '/images/pickleball-action.png',
  running: '/images/running-action.png',
  swimming: '/images/swimming-action.png',
  'table tennis': '/images/table-tennis-action.png',
  cycling: '/images/cycling-action.png',
  esports: '/images/esports-action.png',
  other: '/images/other-sports-action.png',
};

/** The supplied action photo for sport browsing cards and the sport's page header. */
export function getSportImage(sport: string): string {
  return SPORT_IMAGES[sport.trim().toLowerCase()] ?? SPORT_IMAGES.other;
}

const SPORT_MARKERS: Record<string, string> = {
  esports: '🎮',
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
