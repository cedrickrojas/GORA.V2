import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimOptional } from '../../common/validation/transforms';

export const JOIN_REQUEST_MESSAGE_MAX_LENGTH = 300;

/** Only the note: the game comes from the URL and the requester from the token. */
export class CreateJoinRequestDto {
  @IsOptional()
  @Transform(trimOptional)
  @IsString({ message: 'Message must be text.' })
  @MaxLength(JOIN_REQUEST_MESSAGE_MAX_LENGTH, {
    message: `Messages can be at most ${JOIN_REQUEST_MESSAGE_MAX_LENGTH} characters.`,
  })
  message?: string;
}
