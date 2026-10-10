import {
  add,
  calendarOutline,
  chatbubblesOutline,
  compassOutline,
  homeOutline,
  peopleCircleOutline,
  peopleOutline,
  personCircleOutline,
  playCircleOutline,
  pulseOutline,
  ribbonOutline,
  searchOutline,
  settingsOutline,
  sparklesOutline,
} from 'ionicons/icons';

export interface NavLink {
  label: string;
  to: string;
  icon: string;
}

/**
 * The 7 main tabs in the locked order. Phones show them in the bottom tab bar;
 * desktop shows the same items in the top bar. Create opens the create sheet.
 */
export const MAIN_TAB_LINKS: readonly NavLink[] = [
  { label: 'Home', to: '/home', icon: homeOutline },
  { label: 'Search', to: '/search', icon: searchOutline },
  { label: 'Discover', to: '/discover', icon: compassOutline },
  { label: 'Create', to: '/create', icon: add },
  { label: 'Reels', to: '/reels', icon: playCircleOutline },
  { label: 'Chat', to: '/chat', icon: chatbubblesOutline },
  { label: 'Profile', to: '/profile', icon: personCircleOutline },
];

/** Whether a tab owns the current path, including its sub pages (/profile/clubs is Profile). */
export function isTabActive(tab: NavLink, path: string): boolean {
  return path === tab.to || path.startsWith(`${tab.to}/`);
}

/** The avatar dropdown, in the locked order. */
export const PROFILE_DROPDOWN_LINKS: readonly NavLink[] = [
  { label: 'Profile', to: '/profile', icon: personCircleOutline },
  { label: 'My Games', to: '/profile/games', icon: calendarOutline },
  { label: 'My Reels', to: '/profile/reels', icon: playCircleOutline },
  { label: 'My Stories', to: '/profile/stories', icon: sparklesOutline },
  { label: 'Friends', to: '/profile/friends', icon: peopleOutline },
  { label: 'Badges', to: '/profile/badges', icon: ribbonOutline },
  { label: 'Activity', to: '/profile/activity', icon: pulseOutline },
  { label: 'Settings', to: '/profile/settings', icon: settingsOutline },
];

export const MY_CLUBS_LINK: NavLink = { label: 'My Clubs', to: '/profile/clubs', icon: peopleCircleOutline };

/**
 * The sections listed on the Profile tab: the dropdown minus Profile itself,
 * plus My Clubs after Friends. Clubs have no bottom tab; Profile is their home.
 */
export const PROFILE_SECTION_LINKS: readonly NavLink[] = PROFILE_DROPDOWN_LINKS.slice(1).flatMap((link) =>
  link.to === '/profile/friends' ? [link, MY_CLUBS_LINK] : [link],
);