import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useClubsStore } from '@/stores/clubs';
import type { ApiGame } from '@/types/game';
import CreateGamePage from '@/views/CreateGamePage.vue';

vi.mock('@ionic/vue', async () => {
  const { onMounted } = await import('vue');
  return {
    IonPage: { template: '<div><slot /></div>' },
    IonContent: { template: '<main><slot /></main>' },
    IonFooter: { template: '<footer><slot /></footer>' },
    onIonViewWillEnter: onMounted,
    onIonViewDidLeave: vi.fn(),
  };
});
vi.mock('@/components/layout/SubPageHeader.vue', () => ({ default: { template: '<header>Game</header>' } }));
vi.mock('@/components/games/GamePreviewCard.vue', () => ({
  default: { props: ['game'], template: '<article>{{ game.title }}</article>' },
}));

const GAME_ID = '44444444-4444-4444-8444-444444444444';
const SPORT_ID = '11111111-1111-4111-8111-111111111111';
const game: ApiGame = {
  id: GAME_ID,
  title: 'Weekend Basketball',
  description: 'Friendly games',
  autoAccept: false,
  sport: { id: SPORT_ID, name: 'Basketball', iconUrl: null },
  host: {
    id: 'host',
    username: 'host',
    firstName: 'Game',
    lastName: 'Host',
    displayName: 'Game Host',
    profileImageUrl: null,
  },
  club: null,
  requiredPlayers: 8,
  currentPlayers: 0,
  remainingSlots: 8,
  status: 'OPEN',
  gameDate: '2026-11-02',
  startTime: '18:00',
  endTime: '20:00',
  locationName: 'BGC Court',
  latitude: null,
  longitude: null,
  isHost: true,
  isPlayer: false,
  pendingRequestCount: 0,
  canEdit: true,
  canCancel: true,
  createdAt: '2026-10-30T00:00:00Z',
  updatedAt: '2026-10-30T00:00:00Z',
};
let wrapper: VueWrapper | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
let creationError: string | null;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T04:00:00Z'));
  creationError = null;
  fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input);
    if (path.endsWith('/sports'))
      return json(200, [{ id: SPORT_ID, name: 'Basketball', iconUrl: null, isActive: true }]);
    if (init.method === 'POST' && creationError) return json(409, { message: creationError });
    return json(init.method === 'POST' ? 201 : 200, { ...game, ...(init.body ? JSON.parse(String(init.body)) : {}) });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function open(edit = false) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().accessToken = 'test-token';
  vi.spyOn(useClubsStore(), 'load').mockResolvedValue(undefined);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/create/game', component: { template: '<div />' } },
      { path: '/games/:gameId/edit', component: { template: '<div />' } },
      { path: '/games/:gameId', component: { template: '<div />' } },
    ],
  });
  await router.push(edit ? `/games/${GAME_ID}/edit` : '/create/game');
  await router.isReady();
  wrapper = mount(CreateGamePage, { attachTo: document.body, global: { plugins: [pinia, router] } });
  await flushPromises();
  return { page: wrapper, router };
}
async function next(page: VueWrapper) {
  (page.get('.create-game__actions .create-game__submit').element as HTMLButtonElement).click();
  await flushPromises();
}
async function details(page: VueWrapper) {
  await page.get('#game-sport').setValue(SPORT_ID);
  await page.get('#game-title').setValue('Weekend Basketball');
  await page.get('#game-description').setValue('Friendly games');
  await next(page);
}
async function toLocation(page: VueWrapper) {
  await details(page);
  await page.get('#game-players').setValue(8);
  await next(page);
  await page.get('#game-date').setValue('2026-11-02');
  await page.get('#game-start').setValue('18:00');
  await page.get('#game-end').setValue('20:00');
  await next(page);
}
async function toReview(page: VueWrapper) {
  await toLocation(page);
  await page.get('#game-location').setValue('BGC Court');
  await next(page);
}
function writes(method = 'POST') {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === method);
}

describe('Create Game steps', () => {
  test('shows one section, keeps Next at the bottom, and validates only the current step', async () => {
    const { page } = await open();
    expect(page.get('.create-game__step-title').text()).toBe('Game Details');
    expect(page.findAll('input, select, textarea')).toHaveLength(3);
    expect(page.get('footer button').text()).toBe('Next');
    await next(page);
    expect(page.get('.create-game__step-title').text()).toBe('Game Details');
    expect(page.text()).toContain('Choose a sport.');
    expect(page.text()).not.toContain('Choose a date.');
    expect(document.activeElement?.id).toBe('game-sport');
    expect(writes()).toHaveLength(0);
  });

  test('preserves inputs on Back and sends all steps only after final confirmation', async () => {
    const { page } = await open();
    await details(page);
    await page.get('.create-game__back').trigger('click');
    await flushPromises();
    expect((page.get('#game-title').element as HTMLInputElement).value).toBe('Weekend Basketball');
    await next(page);
    await page.get('#game-players').setValue(8);
    await page.get('#game-acceptance').setValue('true');
    await next(page);
    await page.get('#game-date').setValue('2026-11-02');
    await page.get('#game-start').setValue('18:00');
    await page.get('#game-end').setValue('20:00');
    await next(page);
    await page.get('#game-location').setValue('BGC Court');
    await page.get('#game-lat').setValue('14.5');
    await next(page);
    expect(page.get('.create-game__step-title').text()).toBe('Location');
    expect(page.text()).toContain('Give both latitude and longitude');
    await page.get('#game-lng').setValue('121');
    await next(page);
    expect(page.get('.create-game__step-title').text()).toBe('Review');
    expect(page.text()).toContain('Auto Accept');
    expect(writes()).toHaveLength(0);
    await next(page);
    expect(writes()).toHaveLength(1);
    expect(JSON.parse(String(writes()[0][1].body))).toEqual({
      sportId: SPORT_ID,
      title: 'Weekend Basketball',
      description: 'Friendly games',
      clubId: null,
      autoAccept: true,
      requiredPlayers: 8,
      gameDate: '2026-11-02',
      startTime: '18:00',
      endTime: '20:00',
      locationName: 'BGC Court',
      latitude: 14.5,
      longitude: 121,
    });
    expect(page.find('.game-created').exists()).toBe(true);
    await page.get('.game-created__again').trigger('click');
    expect(page.get('.create-game__step-title').text()).toBe('Game Details');
    expect((page.get('#game-title').element as HTMLInputElement).value).toBe('');
  });

  test('blocks an invalid schedule and allows correcting it before continuing', async () => {
    const { page } = await open();
    await details(page);
    await page.get('#game-players').setValue(8);
    await next(page);
    await page.get('#game-date').setValue('2026-11-02');
    await page.get('#game-start').setValue('18:00');
    await page.get('#game-end').setValue('17:00');
    await next(page);
    expect(page.get('.create-game__step-title').text()).toBe('Schedule');
    expect(page.text()).toContain('End time must be after the start time.');
    await page.get('#game-end').setValue('20:00');
    await next(page);
    expect(page.get('.create-game__step-title').text()).toBe('Location');
  });

  test('retains the review and draft after the API refuses creation', async () => {
    const { page } = await open();
    await toReview(page);
    creationError = 'This club is no longer available.';
    await next(page);
    expect(page.get('.create-game__step-title').text()).toBe('Review');
    expect(page.text()).toContain(creationError);
    await page.get('[aria-label="Edit location"]').trigger('click');
    await flushPromises();
    expect((page.get('#game-location').element as HTMLInputElement).value).toBe('BGC Court');
    await next(page);
    creationError = null;
    await next(page);
    expect(page.find('.game-created').exists()).toBe(true);
  });

  test('rechecks earlier steps before saving if the selected date has passed during review', async () => {
    const { page } = await open();
    await toReview(page);
    vi.setSystemTime(new Date('2026-11-03T04:00:00Z'));
    await next(page);
    expect(page.get('.create-game__step-title').text()).toBe('Schedule');
    expect(page.text()).toContain('Choose today or a future date.');
    expect(writes()).toHaveLength(0);
  });

  test('editing loads existing values and saves only changed fields after review', async () => {
    const { page, router } = await open(true);
    expect((page.get('#game-title').element as HTMLInputElement).value).toBe(game.title);
    await page.get('#game-title').setValue('Updated Basketball');
    for (let step = 0; step < 4; step++) await next(page);
    expect(page.get('.create-game__actions .create-game__submit').text()).toBe('Save Changes');
    await next(page);
    expect(writes('PATCH')).toHaveLength(1);
    expect(JSON.parse(String(writes('PATCH')[0][1].body))).toEqual({ title: 'Updated Basketball' });
    expect(router.currentRoute.value.path).toBe(`/games/${GAME_ID}`);
  });
});
