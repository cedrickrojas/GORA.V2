import { IsString, MinLength } from 'class-validator';

export class ConfirmAccountActionDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
