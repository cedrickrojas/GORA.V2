import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ProfileVisibility } from '../../generated/prisma/enums';

const DISTANCE_OPTIONS = [1, 5, 10, 25, 50, 100];

/** Partial update; omitted preferences are left unchanged. */
export class UpdateUserSettingsDto {
  @IsOptional()
  @IsBoolean()
  notifyFriends?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyGames?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyContent?: boolean;

  @IsOptional()
  @IsIn(Object.values(ProfileVisibility))
  profileVisibility?: ProfileVisibility;

  @IsOptional()
  @IsIn([...DISTANCE_OPTIONS, null])
  defaultDistanceKm?: number | null;

  @IsOptional()
  @IsBoolean()
  useDeviceLocation?: boolean;
}
