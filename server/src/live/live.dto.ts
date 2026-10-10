import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class StartLiveDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  title!: string;
}

export class LiveDescriptionDto {
  @IsString()
  @MaxLength(65536)
  @Matches(/^v=0\r?\n/)
  sdp!: string;
}
