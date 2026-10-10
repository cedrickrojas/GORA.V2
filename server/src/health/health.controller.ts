import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthStatus } from './health-status';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): Promise<HealthStatus> {
    return this.healthService.getHealth();
  }
}
