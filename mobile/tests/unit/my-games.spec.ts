import { flushPromises, mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useGamesStore } from '@/stores/games';
import type { JoinedGame } from '@/types/game';
import { canCancelJoining, joinedGameLabel, splitJoinedGames } from '@/utils/my-games';
import MyGamesPage from '@/views/profile/MyGamesPage.vue';

const confirmation = vi.hoisted(() => ({ role: 'destructive' }));
vi.mock('@ionic/vue', async () => {
  const { onMounted } = await import('vue');
  return {
    IonPage: { template: '<div><slot /></div>' },
    IonContent: { template: '<div><slot /></div>' },
    onIonViewWillEnter: onMounted,
    alertController: {
      create: vi.fn(async () => ({
        present: async () => undefined,
        onDidDismiss: async () => ({ role: confirmation.role }),
      })),
    },
  };
});
vi.mock('@/components/layout/SubPageHeader.vue', () => ({ default: { template: '<h1>My Games</h1>' } }));
vi.mock('@/components/games/GamePreviewCard.vue', () => ({
  default: {
    props: ['game'],
    template: '<article>{{ game.title }}</article>',
  },
}));

function joined(overrides: Partial<JoinedGame> = {}): JoinedGame {
  return {
    autoAccept: false,
    id: 'game-1',
    title: 'Weekend basketball',
    description: null,
    sport: { id: 'sport-1', name: 'Basketball', iconUrl: null },
    host: {
      id: 'host',
      username: 'host',
      firstName: 'Game',
      lastName: 'Host',
      displayName: 'Game Host',
      profileImageUrl: null,
    },
    club: null,
    requiredPlayers: 12,
    currentPlayers: 1,
    remainingSlots: 11,
    status: 'OPEN',
    gameDate: '2099-11-02',
    startTime: '18:00',
    endTime: '20:00',
    locationName: 'Court',
    latitude: null,
    longitude: null,
    isHost: false,
    isPlayer: true,
    pendingRequestCount: null,
    canEdit: false,
    canCancel: false,
    createdAt: '2026-10-30T00:00:00Z',
    updatedAt: '2026-10-30T00:00:00Z',
    participationStatus: 'ACTIVE',
    joinRequestStatus: 'ACCEPTED',
    joinedAt: '2026-10-30T00:00:00Z',
    requestedAt: '2026-10-29T00:00:00Z',
    ...overrides,
  };
}

let wrapper: VueWrapper | undefined;
let entry: JoinedGame;
let hosted: JoinedGame;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().accessToken = 'test-token';
  confirmation.role = 'destructive';
  entry = joined();
  hosted = joined({
    id: 'hosted',
    title: 'Hosted volleyball',
    isHost: true,
    canEdit: true,
    canCancel: true,
    pendingRequestCount: 2,
  });
  fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = String(input);
    let data: unknown;
    if (path.endsWith('/games/mine')) data = [hosted];
    else if (path.endsWith('/games/hosted/cancel')) {
      hosted = { ...hosted, status: 'CANCELLED', canEdit: false, canCancel: false };
      data = hosted;
    } else if (path.endsWith('/games/hosted') && init.method === 'PATCH') {
      hosted = { ...hosted, ...JSON.parse(String(init.body)) };
      data = hosted;
    } else if (path.endsWith('/games/joined')) data = [entry];
    else if (path.endsWith('/players/me/leave')) {
      entry = { ...entry, participationStatus: 'LEFT', isPlayer: false, currentPlayers: 0 };
      data = { gameId: entry.id, status: 'LEFT', joinedAt: entry.joinedAt, completedAt: null };
    } else if (path.endsWith('/join-requests/me/cancel')) {
      entry = { ...entry, joinRequestStatus: 'CANCELLED' };
      data = { id: 'request', gameId: entry.id, status: 'CANCELLED' };
    } else if (path.endsWith('/players')) data = { gameId: entry.id, players: [], currentPlayers: 0 };
    else data = entry;
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
});

async function openPage() {
  wrapper = mount(MyGamesPage, { global: { stubs: { RouterLink: RouterLinkStub } } });
  await flushPromises();
  return wrapper;
}

describe('My Games', () => {
  test('hosted cards link to editing and request management', async () => {
    const page = await openPage();
    const links = page.findAllComponents(RouterLinkStub);
    expect(links.some((link) => link.props('to') === '/games/hosted/edit')).toBe(true);
    expect(page.get('.my-games__host-controls').text()).toContain('Manage Requests (2)');
  });

  test('host can switch between automatic and manual approval', async () => {
    const page = await openPage();
    const select = page.get('select');
    await select.setValue('auto');
    await flushPromises();
    expect(useGamesStore().hostedGames[0].autoAccept).toBe(true);
    await select.setValue('manual');
    await flushPromises();
    expect(useGamesStore().hostedGames[0].autoAccept).toBe(false);
    const changes = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith('/games/hosted') && init.method === 'PATCH',
    );
    expect(changes.map(([, init]) => JSON.parse(String(init.body)))).toEqual([
      { autoAccept: true },
      { autoAccept: false },
    ]);
  });

  test('failed mode changes restore the saved option and show the server error', async () => {
    const page = await openPage();
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) =>
      init?.method === 'PATCH'
        ? Promise.resolve(
            new Response(JSON.stringify({ message: 'Only the host can change this game.' }), { status: 403 }),
          )
        : original(url, init),
    );
    await page.get('select').setValue('auto');
    await flushPromises();
    expect((page.get('select').element as HTMLSelectElement).value).toBe('manual');
    expect(page.get('[role="status"]').text()).toContain('Only the host');
  });

  test('cancelling a hosted game keeps it in hosted history and hides editing', async () => {
    const page = await openPage();
    await page.get('.my-games__host-cancel').trigger('click');
    await flushPromises();
    expect(useGamesStore().hostedGames[0].status).toBe('CANCELLED');
    expect(page.find('.my-games__host-cancel').exists()).toBe(false);
    expect(page.find('select').exists()).toBe(false);
    expect(
      page
        .findAll('.my-games__group')
        .some((group) => group.text().includes('Game history') && group.text().includes('Hosted volleyball')),
    ).toBe(true);
    expect(page.findAllComponents(RouterLinkStub).some((link) => link.props('to') === '/games/hosted/edit')).toBe(
      false,
    );
  });
  test('keeps hosted and joined games in two separate sections', async () => {
    const page = await openPage();
    const sections = page.findAll('section');
    expect(sections).toHaveLength(2);
    expect(sections[0].text()).toContain('Hosted Games');
    expect(sections[0].text()).toContain('Hosted volleyball');
    expect(sections[1].text()).toContain('Joined Games');
    expect(sections[1].text()).toContain('Weekend basketball');
  });

  test.each(['accepted', 'pending'])('cancels an %s join and keeps it in history after reloading', async (state) => {
    if (state === 'pending')
      entry = joined({ participationStatus: null, joinRequestStatus: 'PENDING', isPlayer: false, joinedAt: null });
    const page = await openPage();
    await page.get('.my-games__cancel').trigger('click');
    await flushPromises();
    const path = state === 'accepted' ? '/players/me/leave' : '/join-requests/me/cancel';
    const mutations = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith(path) && init.method === 'PATCH',
    );
    expect(mutations).toHaveLength(1);
    expect(page.find('.my-games__cancel').exists()).toBe(false);
    const history = page.findAll('.my-games__group').find((group) => group.text().includes('Join cancelled'));
    expect(history?.text()).toContain('Game history');
    expect(history?.text()).toContain('Weekend basketball');
    await useGamesStore().fetchJoinedGames();
    expect(useGamesStore().joinedGames).toHaveLength(1);
    useAuthStore().accessToken = null;
    expect(useGamesStore().joinedGames).toEqual([]);
  });

  test('dismissing confirmation keeps the player in the game', async () => {
    confirmation.role = 'cancel';
    const page = await openPage();
    await page.get('.my-games__cancel').trigger('click');
    await flushPromises();
    expect(fetchMock.mock.calls.some(([, init]) => init.method === 'PATCH')).toBe(false);
    expect(page.find('.my-games__cancel').exists()).toBe(true);
  });

  test('a failed cancellation displays the server error and preserves the join', async () => {
    const page = await openPage();
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((url, init) =>
      init?.method === 'PATCH'
        ? Promise.resolve(new Response(JSON.stringify({ message: 'This game has already started.' }), { status: 409 }))
        : original(url, init),
    );
    await page.get('.my-games__cancel').trigger('click');
    await flushPromises();
    expect(page.get('[role="status"]').text()).toContain('This game has already started.');
    expect(useGamesStore().joinedGames[0].participationStatus).toBe('ACTIVE');
  });

  test('completed, removed, left, and cancelled joins belong in history', () => {
    const games = [
      joined({ id: 'upcoming' }),
      joined({ id: 'left', participationStatus: 'LEFT' }),
      joined({ id: 'removed', participationStatus: 'REMOVED' }),
      joined({ id: 'completed', participationStatus: 'COMPLETED', status: 'COMPLETED' }),
      joined({ id: 'cancelled', participationStatus: null, joinRequestStatus: 'CANCELLED' }),
    ];
    const groups = splitJoinedGames(games, '2026-10-30');
    expect(groups.upcoming.map((game) => game.id)).toEqual(['upcoming']);
    expect(groups.past).toHaveLength(4);
    expect(groups.past.every((game) => !canCancelJoining(game, '2026-10-30'))).toBe(true);
  });

  test('pending re-requests take priority over an earlier LEFT participation', () => {
    const game = joined({ participationStatus: 'LEFT', joinRequestStatus: 'PENDING' });
    expect(joinedGameLabel(game)).toBe('Pending approval');
    expect(canCancelJoining(game, '2026-10-30')).toBe(true);
    expect(splitJoinedGames([game], '2026-10-30').upcoming).toHaveLength(1);
  });

  test.each(['ACTIVE', 'COMPLETED', 'CANCELLED'] as const)('cannot cancel joining a game with status %s', (status) => {
    expect(canCancelJoining(joined({ status }), '2026-10-30')).toBe(false);
  });
});
