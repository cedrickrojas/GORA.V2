import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap/configure-app';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { AdminService } from './admin.service';

describe('Super admin HTTP access', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let user: CurrentUser & { isActive: boolean };
  const service = {
    overview: jest.fn().mockResolvedValue({ users: 3 }),
    updateUser: jest.fn().mockResolvedValue({}),
    users: jest.fn().mockResolvedValue({ items: [] }),
  };
  const token = () => jwt.sign({ sub: user.id, role: 'SUPER_ADMIN' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(UsersService)
      .useValue({
        findActiveById: () =>
          user.isActive ? Promise.resolve(user) : Promise.resolve(null),
      })
      .overrideProvider(AdminService)
      .useValue(service)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    jwt = app.get(JwtService);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    user = {
      id: randomUUID(),
      username: 'operator',
      email: 'operator@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'SUPER_ADMIN',
      isActive: true,
      profileImageUrl: null,
      city: null,
      bio: null,
    };
  });
  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .expect(401);
    expect(service.overview).not.toHaveBeenCalled();
  });
  it.each(['USER', 'ADMIN'] as const)(
    'rejects %s even when an old signed token says SUPER_ADMIN',
    async (role) => {
      const signed = token();
      user.role = role;
      await request(app.getHttpServer())
        .get('/api/v1/admin/overview')
        .auth(signed, { type: 'bearer' })
        .expect(403);
      expect(service.overview).not.toHaveBeenCalled();
    },
  );
  it('rejects suspended super admins', async () => {
    user.isActive = false;
    await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .auth(token(), { type: 'bearer' })
      .expect(401);
  });
  it('allows active super admins', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .auth(token(), { type: 'bearer' })
      .expect(200);
    expect(response.body).toEqual({ users: 3 });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it.each([
    { role: null },
    { isActive: null },
    { role: 'OWNER' },
    { isActive: 'false' },
    { passwordHash: 'forbidden' },
  ])('rejects invalid or forbidden user changes %j', async (body) => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${randomUUID()}`)
      .auth(token(), { type: 'bearer' })
      .send(body)
      .expect(400);
    expect(service.updateUser).not.toHaveBeenCalled();
  });
  it('validates UUIDs and pagination', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/users/not-a-uuid')
      .auth(token(), { type: 'bearer' })
      .send({ role: 'USER' })
      .expect(400);
    for (const page of ['0', '-1', '1.5', '100001', 'abc']) {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/users?page=${page}`)
        .auth(token(), { type: 'bearer' })
        .expect(400);
    }
    expect(service.updateUser).not.toHaveBeenCalled();
    expect(service.users).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor for changes', async () => {
    const id = randomUUID();
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${id}`)
      .auth(token(), { type: 'bearer' })
      .send({ role: 'ADMIN', isActive: true })
      .expect(200);
    expect(service.updateUser).toHaveBeenCalledWith(
      user.id,
      id,
      expect.objectContaining({ role: 'ADMIN', isActive: true }),
    );
  });
});
