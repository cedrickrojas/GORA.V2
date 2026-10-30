export type RefreshableMainTab = 'home' | 'discover';

const TAB_REFRESH_EVENTS: Record<RefreshableMainTab, string> = {
  home: 'gora:refresh-home-tab',
  discover: 'gora:refresh-discover-tab',
};

/** Ask a mounted tab page to reload its data when its active menu item is tapped again. */
export function requestTabRefresh(tab: RefreshableMainTab): void {
  window.dispatchEvent(new Event(TAB_REFRESH_EVENTS[tab]));
}

export function tabRefreshEvent(tab: RefreshableMainTab): string {
  return TAB_REFRESH_EVENTS[tab];
}
