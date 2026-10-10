import { IsString, MaxLength } from 'class-validator';

export class UploadCoverDto {
  @IsString()
  @MaxLength(349600)
  photo!: string;
}
