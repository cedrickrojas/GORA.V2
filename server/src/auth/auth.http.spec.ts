import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap/configure-app';
import { PrismaService } from '../prisma/prisma.service';

interface StoredUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  bio: string | null;
  city: string | null;
  dateOfBirth: Date | null;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
}

type Where = Partial<StoredUser> & { OR?: Partial<StoredUser>[] };
type Select = Partial<Record<keyof StoredUser, boolean>>;

function matches(user: StoredUser, where: Where): boolean {
  const { OR, ...fields } = where;
  const fieldsMatch = Object.entries(fields).every(
    ([key, value]) => user[key as keyof StoredUser] === value,
  );
  const orMatches = !OR || OR.some((clause) => matches(user, clause));
  return fieldsMatch && orMatches;
}

function pick(user: StoredUser, select: Select): Partial<StoredUser> {
  return Object.fromEntries(
    Object.keys(select).map((key) => [key, user[key as keyof StoredUser]]),
  );
}

/** Just enough of prisma.user for the auth flow, kept in memory. */
function createFakePrisma(users: StoredUser[]) {
  const findOne = ({ where, select }: { where: Where; select: Select }) => {
    const found = users.find((user) => matches(user, where));
    return Promise.resolve(found ? pick(found, select) : null);
  };

  return {
    user: {
      findUnique: findOne,
      findFirst: findOne,
      create: ({
        data,
        select,
      }: {
        data: Omit<
          StoredUser,
          'id' | 'role' | 'isActive' | 'profileImageUrl' | 'bio' | 'city'
        > & {
          city?: string;
        };
        select: Select;
      }) => {
        const user: StoredUser = {
          id: randomUUID(),
          profileImageUrl: null,
          bio: null,
          role: 'USER',
          isActive: true,
          ...data,
          city: data.city ?? null,
          dateOfBirth: data.dateOfBirth ?? null,
        };
        users.push(user);
        return Promise.resolve(pick(user, select));
      },
    },
  };
}

interface ResponseBody {
  success?: boolean;
  message?: string;
  accessToken: string;
  user: Record<string, unknown>;
  [key: string]: unknown;
}

interface RecordedResponse {
  status: number;
  body: ResponseBody;
}

const VALID_REGISTRATION = {
  username: '  Louis_Ray ',
  email: ' Louis@Example.COM ',
  password: 'correct-horse-9',
  confirmPassword: 'correct-horse-9',
  firstName: ' Louis ',
  lastName: ' Ray ',
  city: 'Manila',
  dateOfBirth: '2000-04-12',
};

describe('Auth HTTP flow', () => {
  let app: INestApplication<App>;
  let users: StoredUser[];
  const responses: string[] = [];

  const http = () => request(app.getHttpServer());

  function record(response: request.Response): RecordedResponse {
    responses.push(response.text);
    return { status: response.status, body: response.body as ResponseBody };
  }

  const loginAs = async (email: string, password: string) =>
    record(await http().post('/api/v1/auth/login').send({ email, password }));

  beforeAll(async () => {
    users = [];

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(createFakePrisma(users))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a valid user with normalized fields and a hashed password', async () => {
    const response = record(
      await http().post('/api/v1/auth/register').send(VALID_REGISTRATION),
    );

    expect(response.status).toBe(201);
    expect(Object.keys(response.body as object).sort()).toEqual([
      'accessToken',
      'user',
    ]);
    expect(response.body.user).toEqual({
      id: expect.any(String) as string,
      username: 'louis_ray',
      email: 'louis@example.com',
      firstName: 'Louis',
      lastName: 'Ray',
      role: 'USER',
    });

    const [stored] = users;
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored.passwordHash).not.toContain(VALID_REGISTRATION.password);
    expect(stored).not.toHaveProperty('confirmPassword');
    expect(stored.dateOfBirth?.toISOString()).toBe('2000-04-12T00:00:00.000Z');
  });

  it('signs a JWT that carries only sub, username, and role', async () => {
    const response = await loginAs('louis@example.com', 'correct-horse-9');
    const token = response.body.accessToken;
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    expect(Object.keys(payload).sort()).toEqual([
      'exp',
      'iat',
      'role',
      'sub',
      'username',
    ]);
    expect(payload).toMatchObject({ username: 'louis_ray', role: 'USER' });
    expect((payload.exp as number) - (payload.iat as number)).toBe(3600);
  });

  it('rejects a duplicate username with 409', async () => {
    const response = record(
      await http()
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTRATION,
          username: 'LOUIS_RAY',
          email: 'other@example.com',
        }),
    );

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Username is already taken.');
  });

  it('rejects a duplicate email with 409, ignoring case and spaces', async () => {
    const response = record(
      await http()
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTRATION,
          username: 'someone_else',
          email: '  LOUIS@example.com',
        }),
    );

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Email is already registered.');
  });

  it.each([
    [
      'an invalid email',
      { email: 'not-an-email' },
      'Enter a valid email address.',
    ],
    [
      'a short password',
      { password: 'short1', confirmPassword: 'short1' },
      'Password must be at least 8 characters.',
    ],
    [
      'mismatched passwords',
      { confirmPassword: 'something-else' },
      'Passwords do not match.',
    ],
    ['an invalid username', { username: 'no spaces!' }, 'Username must be'],
    ['a blank first name', { firstName: '   ' }, 'First name is required.'],
    [
      'a future date of birth',
      { dateOfBirth: '2999-01-01' },
      'Date of birth must be a valid past date',
    ],
    ['an unknown field', { role: 'ADMIN' }, 'property role should not exist'],
  ])('rejects %s with 400', async (_label, override, message) => {
    const response = record(
      await http()
        .post('/api/v1/auth/register')
        .send({
          ...VALID_REGISTRATION,
          username: 'fresh_user',
          email: 'fresh@example.com',
          ...override,
        }),
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain(message);
    expect(users).toHaveLength(1);
  });

  it('logs in with correct credentials', async () => {
    const response = await loginAs(' LOUIS@example.com ', 'correct-horse-9');

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe('louis_ray');
    expect(typeof response.body.accessToken).toBe('string');
  });

  it('returns the same generic 401 for a wrong password and an unknown email', async () => {
    const wrongPassword = await loginAs('louis@example.com', 'wrong-password');
    const unknownEmail = await loginAs('nobody@example.com', 'correct-horse-9');

    for (const response of [wrongPassword, unknownEmail]) {
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials.');
    }
  });

  it('returns the current user for a valid JWT', async () => {
    const login = await loginAs('louis@example.com', 'correct-horse-9');
    const response = record(
      await http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: users[0].id,
      username: 'louis_ray',
      email: 'louis@example.com',
      firstName: 'Louis',
      lastName: 'Ray',
      profileImageUrl: null,
      bio: null,
      city: 'Manila',
      role: 'USER',
    });
  });

  it.each([
    ['no token', undefined],
    ['a malformed token', 'Bearer not-a-jwt'],
    [
      'a token signed with another secret',
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwidXNlcm5hbWUiOiJ4Iiwicm9sZSI6IlVTRVIifQ.c2lnbmF0dXJl',
    ],
  ])('rejects /auth/me with %s', async (_label, header) => {
    const call = http().get('/api/v1/auth/me');
    const response = record(
      await (header ? call.set('Authorization', header) : call),
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('blocks inactive accounts from logging in and from using existing tokens', async () => {
    const login = await loginAs('louis@example.com', 'correct-horse-9');
    users[0].isActive = false;

    const inactiveLogin = await loginAs('louis@example.com', 'correct-horse-9');
    const inactiveWrongPassword = await loginAs(
      'louis@example.com',
      'wrong-password',
    );
    const staleToken = record(
      await http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`),
    );

    expect(inactiveLogin.status).toBe(401);
    expect(inactiveLogin.body.message).toBe('This account is inactive.');
    expect(inactiveWrongPassword.body.message).toBe('Invalid credentials.');
    expect(staleToken.status).toBe(401);
    users[0].isActive = true;
  });

  it('never returns a password or password hash in any response', () => {
    expect(responses.length).toBeGreaterThan(10);

    for (const text of responses) {
      expect(text).not.toMatch(/passwordHash|\$argon2/);
      expect(text).not.toContain('correct-horse-9');
    }
  });
});
