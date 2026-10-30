import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

describe('Admin mutation protections', () => {
  let service: AdminService;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    user: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
    report: { updateMany: jest.fn(), count: jest.fn() },
    adminAuditLog: { create: jest.fn() },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.count.mockResolvedValue(2);
    tx.user.findUnique.mockResolvedValue({
      id: 'target',
      username: 'player',
      role: 'USER',
      isActive: true,
    });
    tx.user.update.mockResolvedValue({ role: 'ADMIN', isActive: true });
    tx.report.updateMany.mockResolvedValue({ count: 1 });
    service = new AdminService({
      $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
    } as unknown as PrismaService);
  });
  it.each([{ role: 'USER' as const }, { isActive: false }])(
    'blocks demotion or suspension of self',
    async (body) => {
      await expect(
        service.updateUser('actor', 'actor', body),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
    },
  );
  it('refuses an empty update', async () => {
    await expect(
      service.updateUser('actor', 'target', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rechecks the actor inside the permission lock', async () => {
    tx.user.count.mockResolvedValue(0);
    await expect(
      service.updateUser('actor', 'target', { role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('preserves the last active super admin', async () => {
    tx.user.count.mockResolvedValue(1);
    tx.user.findUnique.mockResolvedValue({
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    await expect(
      service.updateUser('actor', 'target', { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('rejects missing users', async () => {
    tx.user.findUnique.mockResolvedValue(null);
    await expect(
      service.updateUser('actor', 'missing', { role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('records role changes alongside the account update', async () => {
    await service.updateUser('actor', 'target', { role: 'ADMIN' });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'ADMIN' } }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'actor',
        targetId: 'target',
        action: 'USER_UPDATED',
        details: {
          username: 'player',
          before: { role: 'USER', isActive: true },
          after: { role: 'ADMIN', isActive: true },
        },
      }),
    });
  });
  it('detects stale report decisions without recording them', async () => {
    tx.report.updateMany.mockResolvedValue({ count: 0 });
    tx.report.count.mockResolvedValue(1);
    await expect(
      service.updateReport('actor', 'report', {
        status: 'DISMISSED',
        expectedStatus: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });
  it('records the resolving admin and clears resolution metadata on reopen', async () => {
    await service.updateReport('actor', 'report', {
      status: 'RESOLVED',
      expectedStatus: 'REVIEWING',
    });
    expect(tx.report.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'report', status: 'REVIEWING' },
      data: {
        status: 'RESOLVED',
        resolvedById: 'actor',
        resolvedAt: expect.any(Date),
      },
    });
    await service.updateReport('actor', 'report', {
      status: 'PENDING',
      expectedStatus: 'RESOLVED',
    });
    expect(tx.report.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'report', status: 'RESOLVED' },
      data: { status: 'PENDING', resolvedById: null, resolvedAt: null },
    });
  });
});
