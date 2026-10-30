import { flushPromises, mount } from '@vue/test-utils';
import { IonicVue } from '@ionic/vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { routeLocationKey, routerKey } from 'vue-router';
import { routes } from '@/router';
import { useAuthStore } from '@/stores/auth';
import type { RegisterInput } from '@/types/auth';
import {
  resolveAuthNavigation,
  postLoginPath,
  safeRedirectPath,
  validateLoginInput,
  validateRegisterInput,
} from '@/utils/auth';
import RegisterPage from '@/views/auth/RegisterPage.vue';
import LoginPage from '@/views/auth/LoginPage.vue';

const TOKEN_KEY = 'gora.accessToken';

const VALID: RegisterInput = {
  username: 'louis_ray',
  firstName: 'Louis',
  lastName: 'Ray',
  email: 'louis@example.com',
  password: 'correct-horse-9',
  confirmPassword: 'correct-horse-9',
};

const SAFE_USER = {
  id: 'u-1',
  username: 'louis_ray',
  email: 'louis@example.com',
  firstName: 'Louis',
  lastName: 'Ray',
  role: 'USER',
};

const ME = { ...SAFE_USER, profileImageUrl: null, bio: null, city: 'Manila' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Handler = (url: string, init: RequestInit) => Response;

function mockApi(handler: Handler) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    Promise.resolve(handler(String(input), init)),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth form validation', () => {
  test('accepts a valid registration', () => {
    expect(validateRegisterInput(VALID)).toEqual({});
  });

  test('rejects an invalid email, a short password, and mismatched passwords', () => {
    expect(validateRegisterInput({ ...VALID, email: 'not-an-email' }).email).toBe('Enter a valid email address.');
    expect(validateRegisterInput({ ...VALID, password: 'short1', confirmPassword: 'short1' }).password).toBe(
      'Password must be at least 8 characters.',
    );
    expect(validateRegisterInput({ ...VALID, confirmPassword: 'different-9' }).confirmPassword).toBe(
      'Passwords do not match.',
    );
  });

  test('rejects invalid usernames and blank names, trimming first', () => {
    expect(validateRegisterInput({ ...VALID, username: 'ab' }).username).toBeDefined();
    expect(validateRegisterInput({ ...VALID, username: 'bad name' }).username).toBeDefined();
    expect(validateRegisterInput({ ...VALID, username: 'double..dot' }).username).toBeDefined();
    expect(validateRegisterInput({ ...VALID, username: '  Louis_Ray  ' }).username).toBeUndefined();
    expect(validateRegisterInput({ ...VALID, firstName: '   ' }).firstName).toBe('First name is required.');
  });

  test('login needs a valid email and a password', () => {
    expect(validateLoginInput({ email: 'louis@example.com', password: 'x' })).toEqual({});
    expect(validateLoginInput({ email: '', password: '' })).toEqual({
      email: 'Email is required.',
      password: 'Password is required.',
    });
  });
});

describe('route guards', () => {
  const protectedPage = (fullPath: string) => ({ fullPath, requiresAuth: true, guestOnly: false });
  const guestPage = (fullPath: string) => ({ fullPath, requiresAuth: false, guestOnly: true });

  test('the public landing page, 7 protected main tabs, and auth pages are configured', () => {
    const landing = routes.find((route) => route.name === 'landing');
    expect(landing?.path).toBe('/');
    expect(landing?.meta?.requiresAuth).not.toBe(true);
    expect(landing?.meta?.guestOnly).toBe(true);

    const tabs = routes.find((route) => route.meta?.requiresAuth && route.children);
    const paths = (tabs?.children ?? []).map((route) => route.path);

    expect(tabs?.meta?.requiresAuth).toBe(true);
    for (const path of ['home', 'search', 'discover', 'create', 'reels', 'chat', 'profile']) {
      expect(paths).toContain(path);
    }
    expect(routes.find((route) => route.path === '/login')?.meta?.guestOnly).toBe(true);
    expect(routes.find((route) => route.path === '/register')?.meta?.guestOnly).toBe(true);
  });

  test('sends logged-out users on protected pages to /login, keeping where they were going', () => {
    expect(resolveAuthNavigation(protectedPage('/home'), false)).toEqual({ path: '/login' });
    expect(resolveAuthNavigation(protectedPage('/profile'), false)).toEqual({
      path: '/login',
      query: { redirect: '/profile' },
    });
  });

  test('lets logged-in users through and keeps them off login/register', () => {
    expect(resolveAuthNavigation(protectedPage('/chat'), true)).toBe(true);
    expect(resolveAuthNavigation(guestPage('/login'), true)).toEqual({ path: '/home' });
    expect(resolveAuthNavigation(guestPage('/register'), true)).toEqual({ path: '/home' });
    expect(resolveAuthNavigation(guestPage('/'), true)).toEqual({ path: '/home' });
    expect(resolveAuthNavigation(guestPage('/'), false)).toBe(true);
    expect(resolveAuthNavigation(guestPage('/login'), false)).toBe(true);
  });

  test('only same-app paths are accepted as a redirect', () => {
    expect(safeRedirectPath('/search/basketball')).toBe('/search/basketball');
    expect(safeRedirectPath('https://evil.example')).toBe('/home');
    expect(safeRedirectPath('//evil.example')).toBe('/home');
    expect(safeRedirectPath('/login')).toBe('/home');
    expect(safeRedirectPath(undefined)).toBe('/home');
  });

  test.each(['/', '/login', '/register', '/home', '/profile', '/chat'])('super admins enter the dashboard from %s', (path) => {
    const target = ['/', '/login', '/register'].includes(path) ? guestPage(path) : protectedPage(path);
    expect(resolveAuthNavigation(target, true, 'SUPER_ADMIN')).toEqual({ path: '/admin' });
  });

  test('super admins can navigate dashboard sections without a redirect loop', () => {
    expect(resolveAuthNavigation({ ...protectedPage('/admin?section=users'), superAdminOnly: true }, true, 'SUPER_ADMIN')).toBe(true);
  });

  test.each(['USER', 'ADMIN'] as const)('%s accounts cannot enter the super admin dashboard', (role) => {
    expect(resolveAuthNavigation({ ...protectedPage('/admin'), superAdminOnly: true }, true, role)).toEqual({ path: '/home' });
  });

  test('a logged-out dashboard request goes through login first', () => {
    expect(resolveAuthNavigation({ ...protectedPage('/admin'), superAdminOnly: true }, false)).toEqual({ path: '/login', query: { redirect: '/admin' } });
  });

  test('post-login destinations honor the account role over stale social redirects', () => {
    for (const redirect of [undefined, '/home', '/profile', '/admin?section=reports', 'https://evil.example']) {
      expect(postLoginPath(redirect, 'SUPER_ADMIN')).toBe('/admin');
    }
    expect(postLoginPath(undefined, 'USER')).toBe('/home');
    expect(postLoginPath('/profile', 'USER')).toBe('/profile');
    expect(postLoginPath('https://evil.example', 'USER')).toBe('/home');
  });
});

describe('auth store', () => {
  test('login stores the token, loads the current user, and sends normalized input', async () => {
    const fetchMock = mockApi((url) =>
      url.endsWith('/auth/login')
        ? jsonResponse(200, { user: SAFE_USER, accessToken: 'token-123' })
        : jsonResponse(200, ME),
    );
    const auth = useAuthStore();

    await auth.login({ email: '  LOUIS@example.com ', password: 'correct-horse-9' });

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.accessToken).toBe('token-123');
    expect(auth.currentUser?.city).toBe('Manila');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-123');

    const [loginUrl, loginInit] = fetchMock.mock.calls[0];
    expect(String(loginUrl)).toBe('/api/v1/auth/login');
    expect(JSON.parse(String(loginInit?.body))).toEqual({ email: 'louis@example.com', password: 'correct-horse-9' });

    const [, meInit] = fetchMock.mock.calls[1];
    expect((meInit?.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  test('a failed login surfaces the server message and stores nothing', async () => {
    mockApi(() => jsonResponse(401, { success: false, message: 'Invalid credentials.' }));
    const auth = useAuthStore();

    await expect(auth.login({ email: 'louis@example.com', password: 'wrong' })).rejects.toThrow('Invalid credentials.');
    expect(auth.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('logout clears the token, the user, and saved state', async () => {
    mockApi((url) =>
      url.endsWith('/auth/register')
        ? jsonResponse(201, { user: SAFE_USER, accessToken: 'token-abc' })
        : jsonResponse(200, ME),
    );
    const auth = useAuthStore();
    await auth.register(VALID);
    expect(auth.isAuthenticated).toBe(true);

    await auth.logout();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.accessToken).toBeNull();
    expect(auth.currentUser).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('initialize restores a saved session and drops a rejected token', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved-token');
    mockApi(() => jsonResponse(200, ME));
    const restored = useAuthStore();
    await restored.initialize();
    expect(restored.isAuthenticated).toBe(true);

    setActivePinia(createPinia());
    mockApi(() => jsonResponse(401, { success: false, message: 'Unauthorized' }));
    const rejected = useAuthStore();
    await rejected.initialize();
    expect(rejected.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test('a restored super admin session leaves the social home for the dashboard', async () => {
    localStorage.setItem(TOKEN_KEY, 'saved-admin-token');
    mockApi(() => jsonResponse(200, { ...ME, role: 'SUPER_ADMIN' }));
    const auth = useAuthStore();
    await auth.initialize();
    expect(resolveAuthNavigation({ fullPath: '/home', requiresAuth: true, guestOnly: false }, auth.isAuthenticated, auth.currentUser?.role)).toEqual({ path: '/admin' });
  });
});

describe('LoginPage.vue role routing', () => {
  test.each([
    { role: 'SUPER_ADMIN', redirect: undefined, destination: '/admin' },
    { role: 'SUPER_ADMIN', redirect: '/home', destination: '/admin' },
    { role: 'SUPER_ADMIN', redirect: '/profile', destination: '/admin' },
    { role: 'USER', redirect: undefined, destination: '/home' },
    { role: 'USER', redirect: '/profile', destination: '/profile' },
  ])('$role login redirects to $destination with redirect=$redirect', async ({ role, redirect, destination }) => {
    mockApi(url => url.endsWith('/auth/login')
      ? jsonResponse(200, { user: { ...SAFE_USER, role }, accessToken: 'login-token' })
      : jsonResponse(200, { ...ME, role }));
    const replace = vi.fn().mockResolvedValue(undefined);
    const wrapper = mount(LoginPage, {
      global: {
        plugins: [IonicVue, createPinia()],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
        provide: {
          [routerKey as symbol]: { replace },
          [routeLocationKey as symbol]: { query: { redirect } },
        },
      },
    });
    await wrapper.find('#login-email').setValue('louis@example.com');
    await wrapper.find('#login-password').setValue('correct-horse-9');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(replace).toHaveBeenCalledWith(destination);
    wrapper.unmount();
  });
});

describe('RegisterPage.vue', () => {
  function mountPage() {
    return mount(RegisterPage, {
      global: {
        plugins: [IonicVue, createPinia()],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
        provide: { [routerKey as symbol]: { replace: vi.fn() } },
      },
    });
  }

  async function fill(wrapper: ReturnType<typeof mountPage>, input: RegisterInput) {
    const fields: [string, string][] = [
      ['#register-username', input.username],
      ['#register-first-name', input.firstName],
      ['#register-last-name', input.lastName],
      ['#register-email', input.email],
      ['#register-password', input.password],
      ['#register-confirm-password', input.confirmPassword],
    ];

    for (const [selector, value] of fields) {
      await wrapper.find(selector).setValue(value);
    }
  }

  test('shows the form fields and blocks mismatched passwords without calling the API', async () => {
    const fetchMock = mockApi(() => jsonResponse(500, {}));
    const wrapper = mountPage();

    for (const label of ['Username', 'First Name', 'Last Name', 'Email', 'Password', 'Confirm Password']) {
      expect(wrapper.text()).toContain(label);
    }
    expect(wrapper.text()).toContain('Already have an account?');

    await fill(wrapper, { ...VALID, confirmPassword: 'different-9' });
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Passwords do not match.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('shows "Creating account..." while pending and puts a duplicate-username error on the field', async () => {
    let respond: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))),
    );
    const wrapper = mountPage();

    await fill(wrapper, VALID);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const button = wrapper.find('button[type="submit"]');
    expect(button.text()).toBe('Creating account...');
    expect(button.attributes('disabled')).toBeDefined();

    respond(jsonResponse(409, { success: false, message: 'Username is already taken.' }));
    await flushPromises();

    expect(button.text()).toBe('Create Account');
    expect(wrapper.find('#register-username-error').text()).toBe('Username is already taken.');
    expect((wrapper.find('#register-password').element as HTMLInputElement).value).toBe('');
  });
});
