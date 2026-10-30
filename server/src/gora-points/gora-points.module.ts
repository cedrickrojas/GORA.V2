import { Module } from '@nestjs/common';
import { GoraPointsService } from './gora-points.service';

@Module({ providers: [GoraPointsService], exports: [GoraPointsService] })
export class GoraPointsModule {}
