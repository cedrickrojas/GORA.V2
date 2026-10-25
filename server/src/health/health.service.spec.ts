import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

function createService(queryRaw: jest.Mock): HealthService {
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  return new HealthService(prisma);
}

describe('HealthService', () => {
  it('returns the GORA API health payload when the database responds', async () => {
    const service = createService(
      jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    );
    const result = await service.getHealth();

    expect(result.success).toBe(true);
    expect(result.message).toBe('GORA API is running');
    expect(result.database).toBe('connected');
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });

  it('throws 503 without leaking driver details when the database fails', async () => {
    const service = createService(
      jest
        .fn()
        .mockRejectedValue(
          new Error('connect to postgresql://postgres:secret@localhost failed'),
        ),
    );

    const error = await service.getHealth().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).toBe('Database connection failed');
    expect((error as Error).message).not.toContain('secret');
  });
});
