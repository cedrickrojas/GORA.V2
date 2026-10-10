import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim } from '../../common/validation/transforms';

export const CLUB_CHAT_MESSAGE_MAX_LENGTH = 2000;
export const CLUB_CHAT_PAGE_DEFAULT = 30;

/** Only the text: the club, conversation, and sender always come from the URL and the token. */
export class SendClubChatMessageDto {
  @Transform(trim)
  @IsString({ message: 'Message must be text.' })
  @IsNotEmpty({ message: 'Write a message before sending.' })
  @MaxLength(CLUB_CHAT_MESSAGE_MAX_LENGTH, {
    message: `Messages can be at most ${CLUB_CHAT_MESSAGE_MAX_LENGTH} characters.`,
  })
  content!: string;
}

export class ClubChatMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** The id of the oldest message already loaded; returns the messages before it. */
  @IsOptional()
  @IsUUID('all', { message: 'before must be a message id.' })
  before?: string;
}
