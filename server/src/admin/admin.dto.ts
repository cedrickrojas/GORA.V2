import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ReportStatus, UserRole } from '../generated/prisma/client';

export class AdminPageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
}

export class AdminUsersQuery extends AdminPageQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum({ active: 'active', suspended: 'suspended' })
  status?: 'active' | 'suspended';
}

export class AdminReportsQuery extends AdminPageQuery {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}

export class UpdateAdminUserDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(UserRole)
  role?: UserRole;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateReportDto {
  @IsEnum(ReportStatus)
  status!: ReportStatus;

  @IsEnum(ReportStatus)
  expectedStatus!: ReportStatus;
}

export class UpdateSportStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
