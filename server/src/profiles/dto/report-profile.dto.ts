import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason } from '../../generated/prisma/client';
import { trim } from '../../common/validation/transforms';

export class ReportProfileDto {
  @IsIn(Object.values(ReportReason))
  reason!: ReportReason;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;
}
