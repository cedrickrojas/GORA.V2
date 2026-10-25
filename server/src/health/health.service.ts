import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { HealthStatus } from './health-status';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      this.logger.error('Database health check failed');
      throw new ServiceUnavailableException('Database connection failed');
    }

    return {
      success: true,
      message: 'GORA API is running',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
