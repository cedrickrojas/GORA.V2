import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import ClubFormFields from '@/components/clubs/ClubFormFields.vue';
import { buildMockClubs } from '@/services/mock/mock-clubs';
import { useAuthStore } from '@/stores/auth';
import { useClubsStore } from '@/stores/clubs';
import { emptyClubForm, validateClubForm } from '@/utils/club-form';
import CreateClubPage from '@/views/profile/CreateClubPage.vue';

vi.mock('@ionic/vue', () => ({
  IonPage: { template: '<div><slot /></div>' },
  IonContent: { template: '<main><slot /></main>' },
  IonFooter: { template: '<footer><slot /></footer>' },
  IonIcon: { template: '<span />' },
  onIonViewDidLeave: vi.fn(),
}));
vi.mock('@/components/layout/SubPageHeader.vue', () => ({ default: { template: '<header>Club</header>' } }));
vi.mock('@/components/clubs/ClubAvatar.vue', () => ({ default: { template: '<span>Avatar</span>' } }));

const SPORT_ID = '11111111-1111-4111-8111-111111111111';
let wrapper: VueWrapper | undefined;
const createdClub = buildMockClubs(Date.now())[0]!;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: SPORT_ID, name: 'Basketball', iconUrl: null, isActive: true }]), {
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function open() {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().accessToken = 'test-token';
  const create = vi.spyOn(useClubsStore(), 'create').mockResolvedValue({ ok: true, club: createdClub });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/create/club', component: { template: '<div />' } },
      { path: '/clubs/:clubId', component: { template: '<div />' } },
      { path: '/chat/clubs/:clubId', component: { template: '<div />' } },
    ],
  });
  await router.push('/create/club');
  await router.isReady();
  wrapper = mount(CreateClubPage, { attachTo: document.body, global: { plugins: [pinia, router] } });
  await flushPromises();
  return { page: wrapper, create, router };
}
async function next(page: VueWrapper) {
  (page.get('.create-club__submit').element as HTMLButtonElement).click();
  await flushPromises();
}
async function back(page: VueWrapper) {
  await page.get('.create-club__back').trigger('click');
  await flushPromises();
}
async function details(page: VueWrapper) {
  await page.get('#club-name').setValue('Weekend Basketball');
  await page.get('#club-description').setValue('Friendly games for everyone.');
  await next(page);
}
async function location(page: VueWrapper) {
  await details(page);
  await next(page);
  await page.get('#club-sport').setValue(SPORT_ID);
  await next(page);
}
async function review(page: VueWrapper) {
  await location(page);
  for (let step = 3; step < 8; step++) await next(page);
}

describe('Create Club steps', () => {
  test('shows only club details and validates the current section before advancing', async () => {
    const { page, create } = await open();
    expect(page.get('.create-club__step-title').text()).toBe('Club Details');
    expect(page.find('#club-sport').exists()).toBe(false);
    expect(page.find('#club-photo').exists()).toBe(false);
    expect(page.find('.create-club__back').exists()).toBe(false);
    await next(page);
    expect(page.text()).toContain('Club name must be at least 2 characters.');
    expect(page.text()).not.toContain('Choose a primary sport.');
    expect(document.activeElement?.id).toBe('club-name');
    await details(page);
    expect(page.get('.create-club__step-title').text()).toBe('Photos & About');
    expect(create).not.toHaveBeenCalled();
  });

  test('preserves a custom username and optional inputs across Back and review edits', async () => {
    const { page, create, router } = await open();
    await page.get('#club-name').setValue('Weekend Basketball');
    expect((page.get('#club-username').element as HTMLInputElement).value).toBe('weekend-basketball');
    await page.get('#club-username').setValue('our-court');
    await page.get('#club-description').setValue('Friendly games for everyone.');
    await next(page);
    await page.get('#club-about').setValue('Beginners are welcome.');
    await next(page);
    await page.get('#club-sport').setValue(SPORT_ID);
    await next(page);
    await page.get('#club-city').setValue('Manila');
    await page.get('#club-lat').setValue('14.5');
    await page.get('#club-lng').setValue('121');
    await next(page);
    await page.get('#club-max').setValue('20');
    await page.get('input[value="APPROVAL_REQUIRED"]').setValue();
    await next(page);
    await page.get('[aria-label="New tag"]').setValue('weekend');
    await page.get('[aria-label="New tag"]').trigger('keydown', { key: 'Enter' });
    await next(page);
    await back(page);
    expect(page.text()).toContain('#weekend');
    await next(page);
    await page.get('#club-start').setValue('17:00');
    await page.get('#club-end').setValue('19:00');
    await next(page);
    await page.get('#club-contactEmail').setValue('club@example.com');
    await next(page);
    expect(page.get('.create-club__step-title').text()).toBe('Review');
    expect(page.get('.create-club__review').text()).toContain('Beginners are welcome.');
    expect(create).not.toHaveBeenCalled();
    await page.get('[aria-label="Edit Club Details"]').trigger('click');
    await page.get('#club-name').setValue('Saturday Basketball');
    expect((page.get('#club-username').element as HTMLInputElement).value).toBe('our-court');
    for (let step = 0; step < 8; step++) await next(page);
    await next(page);
    expect(create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        name: 'Saturday Basketball',
        username: 'our-court',
        about: 'Beginners are welcome.',
        primarySportId: SPORT_ID,
        city: 'Manila',
        latitude: 14.5,
        longitude: 121,
        maxMembers: 20,
        membershipType: 'APPROVAL_REQUIRED',
        tags: ['weekend'],
        activityStartTime: '17:00',
        activityEndTime: '19:00',
        contactEmail: 'club@example.com',
      }),
    );
    expect(page.find('.create-club__actions').exists()).toBe(false);
    await page.get('.club-created__primary').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe(`/clubs/${createdClub.id}`);
  });

  test('blocks invalid optional photos, coordinate pairs, capacity, schedules, and contact links in their sections', async () => {
    const { page, create } = await open();
    await details(page);
    await page.get('#club-photo').setValue('broken');
    await next(page);
    expect(page.text()).toContain('Profile photo must be a valid http(s) URL.');
    await page.get('#club-photo').setValue('');
    await next(page);
    await next(page);
    expect(page.text()).toContain('Choose a primary sport.');
    await page.get('#club-sport').setValue(SPORT_ID);
    await next(page);
    await page.get('#club-lat').setValue('14.5');
    await next(page);
    expect(page.text()).toContain('Give both latitude and longitude, or neither.');
    await page.get('#club-lat').setValue('');
    await next(page);
    await page.get('#club-max').setValue('0');
    await next(page);
    expect(page.text()).toContain('Maximum members must be at least 1.');
    await page.get('#club-max').setValue('50');
    await next(page);
    await next(page);
    await page.get('#club-start').setValue('19:00');
    await page.get('#club-end').setValue('17:00');
    await next(page);
    expect(page.text()).toContain('End time must be after the start time.');
    await page.get('#club-end').setValue('20:00');
    await next(page);
    await page.get('#club-contactEmail').setValue('bad');
    await next(page);
    expect(page.text()).toContain('Contact email must be a valid email address.');
    expect(create).not.toHaveBeenCalled();
  });

  test('keeps the draft on server failure and allows correction before retrying', async () => {
    const { page, create } = await open();
    create.mockResolvedValueOnce({ ok: false, message: 'Club username is already taken.' });
    await review(page);
    await next(page);
    expect(page.text()).toContain('Club username is already taken.');
    expect(page.get('.create-club__step-title').text()).toBe('Review');
    await page.get('[aria-label="Edit Club Details"]').trigger('click');
    await page.get('#club-username').setValue('new-court');
    for (let step = 0; step < 8; step++) await next(page);
    await next(page);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ username: 'new-court' }));
    expect(page.find('.club-created').exists()).toBe(true);
  });

  test('disables navigation and prevents duplicate creation while saving', async () => {
    const { page, create } = await open();
    await review(page);
    let finish!: (value: { ok: true; club: typeof createdClub }) => void;
    create.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await next(page);
    expect(page.get('.create-club__submit').attributes('disabled')).toBeDefined();
    expect(page.get('.create-club__back').attributes('disabled')).toBeDefined();
    await page.get('form').trigger('submit');
    expect(create).toHaveBeenCalledTimes(1);
    finish({ ok: true, club: createdClub });
    await flushPromises();
    expect(page.find('.club-created').exists()).toBe(true);
  });

  test('keeps every section available by default in the shared Manage Club fields', () => {
    const form = emptyClubForm();
    wrapper = mount(ClubFormFields, { props: { modelValue: form, errors: validateClubForm(form), sportOptions: [] } });
    for (const id of [
      'club-name',
      'club-photo',
      'club-sport',
      'club-city',
      'club-max',
      'club-start',
      'club-contactEmail',
    ]) {
      expect(wrapper.get(`#${id}`).isVisible()).toBe(true);
    }
  });
});
