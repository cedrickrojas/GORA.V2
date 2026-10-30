import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { ApiError } from '@/services/api-client';
import { adminApi } from '@/services/admin.service';
import { useAuthStore } from '@/stores/auth';
import AdminDashboardPage from '@/views/admin/AdminDashboardPage.vue';

vi.mock('@ionic/vue', async () => {
  const { onMounted } = await import('vue');
  return {
    IonPage: { template: '<div><slot /></div>' },
    IonContent: { template: '<div><slot /></div>' },
    IonIcon: { template: '<span />' },
    onIonViewWillEnter: onMounted,
    onIonViewWillLeave: vi.fn(),
  };
});
vi.mock('@/services/admin.service', () => ({
  adminApi: {
    overview: vi.fn(),
    users: vi.fn(),
    reports: vi.fn(),
    sports: vi.fn(),
    audit: vi.fn(),
    updateUser: vi.fn(),
    updateReport: vi.fn(),
    updateSport: vi.fn(),
  },
}));

const overview = {
  users: 42,
  activeUsers: 40,
  games: 8,
  clubs: 4,
  posts: 12,
  reels: 3,
  pendingReports: 2,
  reviewingReports: 1,
  dailyRegistrations: [{ day: '2026-10-26', total: 5 }],
};
let wrapper: VueWrapper | undefined;
async function open(section = '') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.accessToken = 'test-token';
  auth.currentUser = {
    id: 'self',
    username: 'owner',
    email: 'owner@example.com',
    firstName: 'Owner',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
    bio: null,
    city: null,
    profileImageUrl: null,
  };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin', component: AdminDashboardPage },
      { path: '/home', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  });
  await router.push(`/admin${section ? `?section=${section}` : ''}`);
  await router.isReady();
  wrapper = mount(AdminDashboardPage, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  });
  await flushPromises();
  return wrapper;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(adminApi.overview).mockResolvedValue(overview);
  vi.mocked(adminApi.users).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  vi.mocked(adminApi.reports).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
});

describe('Super admin dashboard', () => {
  it('logs out directly from the admin workspace', async () => {
    const page = await open();
    await page.find('.sidebar-footer .logout-button').trigger('click');
    await flushPromises();
    expect(useAuthStore().isAuthenticated).toBe(false);
    expect(page.vm.$route.path).toBe('/login');
  });
  it('renders API counts and an accessible registration chart', async () => {
    const page = await open();
    expect(page.text()).toContain('42');
    expect(page.text()).toContain('40 active accounts');
    expect(page.find('[role="img"]').attributes('aria-label')).toContain(
      '2026-10-26: 5',
    );
    expect(adminApi.overview).toHaveBeenCalledWith('test-token');
  });
  it('applies account filters to the server query', async () => {
    const page = await open('users');
    await page.find('input[type="search"]').setValue('someone@example.com');
    await page.find('select[aria-label="Filter by role"]').setValue('ADMIN');
    await page.find('form.filters').trigger('submit');
    await flushPromises();
    const params = vi.mocked(adminApi.users).mock.lastCall![1];
    expect(params.get('search')).toBe('someone@example.com');
    expect(params.get('role')).toBe('ADMIN');
    expect(params.get('page')).toBe('1');
  });
  it('requires confirmation before changing a sport', async () => {
    vi.mocked(adminApi.sports).mockResolvedValue([
      {
        id: 'sport',
        name: 'Basketball',
        description: 'Court games',
        isActive: true,
        _count: { players: 2, games: 1 },
      },
    ]);
    const page = await open('sports');
    await page.find('.sport-card button').trigger('click');
    await flushPromises();
    expect(adminApi.updateSport).not.toHaveBeenCalled();
    expect(page.find('dialog').attributes('open')).toBeDefined();
    await page.find('dialog form').trigger('submit');
    await flushPromises();
    expect(adminApi.updateSport).toHaveBeenCalledWith(
      'test-token',
      'sport',
      false,
    );
    expect(page.text()).toContain('Changes saved.');
  });
  it('returns to a valid page when the last matching account changes status', async () => {
    const user = {
      id: 'member',
      username: 'member',
      firstName: 'Test',
      lastName: 'Member',
      email: 'member@example.test',
      role: 'USER' as const,
      isActive: true,
      city: null,
      createdAt: '2026-10-26T00:00:00Z',
    };
    vi.mocked(adminApi.users).mockResolvedValue({
      items: [user],
      total: 21,
      page: 1,
      pageSize: 20,
    });
    const page = await open('users');
    await page
      .find('select[aria-label="Filter by account status"]')
      .setValue('active');
    await page.find('form.filters').trigger('submit');
    await flushPromises();
    await page.findAll('.pagination button')[1].trigger('click');
    await flushPromises();
    expect(vi.mocked(adminApi.users).mock.lastCall![1].get('page')).toBe('2');
    await page.find('.text-button').trigger('click');
    await flushPromises();
    await page.findAll('dialog select')[1].setValue(false);
    vi.mocked(adminApi.users).mockResolvedValue({
      items: [],
      total: 20,
      page: 1,
      pageSize: 20,
    });
    await page.find('dialog form').trigger('submit');
    await flushPromises();
    expect(adminApi.updateUser).toHaveBeenCalledWith('test-token', 'member', {
      role: 'USER',
      isActive: false,
    });
    expect(vi.mocked(adminApi.users).mock.lastCall![1].get('page')).toBe('1');
    expect(page.find('.pagination').text()).toContain('Page 1');
  });
  it('clears sensitive data if access is revoked', async () => {
    const page = await open();
    vi.mocked(adminApi.overview).mockRejectedValueOnce(
      new ApiError(403, 'Super admin access is required.'),
    );
    vi.spyOn(useAuthStore(), 'loadCurrentUser').mockResolvedValue();
    await page.find('.page-heading button').trigger('click');
    await flushPromises();
    expect(page.text()).toContain('Super admin access required');
    expect(page.find('.stat-grid').exists()).toBe(false);
  });
  it('does not make admin API calls for a non-super-admin account', async () => {
    const page = await open();
    useAuthStore().currentUser!.role = 'ADMIN';
    vi.mocked(adminApi.overview).mockClear();
    await page.find('.page-heading button').trigger('click');
    await flushPromises();
    expect(adminApi.overview).not.toHaveBeenCalled();
    expect(page.text()).toContain('Super admin access required');
  });
});
