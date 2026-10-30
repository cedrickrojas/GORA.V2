import { IsString, MaxLength } from 'class-validator';

export class UploadProfilePhotoDto {
  @IsString()
  @MaxLength(349600)
  photo!: string;
}
