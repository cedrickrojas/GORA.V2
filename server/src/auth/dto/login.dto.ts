import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLowercase } from '../../common/validation/transforms';
import { PASSWORD_MAX_LENGTH } from './register.dto';

export class LoginDto {
  @Transform(trimLowercase)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required.' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
