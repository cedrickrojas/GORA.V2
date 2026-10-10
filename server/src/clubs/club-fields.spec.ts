import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  minutesOfDay,
  normalizeClubTag,
  normalizeClubTags,
  normalizeClubUsername,
} from './club-fields';
import { CreateClubDto, UpdateClubDto } from './dto/club.dto';

const SPORT_ID = '0b9f4a4e-8f39-4c55-9f5e-1f7c1f1d2a3b';

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Manila Volleyball Club',
    username: 'manila-volleyball',
    description: 'Weekend volleyball.',
    primarySportId: SPORT_ID,
    maxMembers: 50,
    ...overrides,
  };
}

async function errorsFor(
  cls: typeof CreateClubDto | typeof UpdateClubDto,
  input: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, input));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('club field normalization', () => {
  it('normalizes a club username', () => {
    expect(normalizeClubUsername('  @@Manila-Volleyball ')).toBe(
      'manila-volleyball',
    );
  });

  it('normalizes tags to lowercase letters and digits and drops duplicates', () => {
    expect(normalizeClubTag('#Weekend Games!')).toBe('weekendgames');
    expect(normalizeClubTags(['#Beginners', 'beginners', 'U-18'])).toEqual([
      'beginners',
      'u18',
    ]);
  });

  it('reads HH:MM as minutes of the day', () => {
    expect(minutesOfDay('18:30')).toBe(1110);
  });
});

describe('CreateClubDto', () => {
  it('accepts the required fields', async () => {
    expect(await errorsFor(CreateClubDto, createInput())).toEqual([]);
  });

  it.each([
    [undefined, 'Maximum members is required.'],
    [0, 'Maximum members must be at least 1.'],
    [-1, 'Maximum members must be at least 1.'],
    [2.5, 'Maximum members must be a whole number.'],
    ['50', 'Maximum members must be a whole number.'],
    ['', 'Maximum members must be a whole number.'],
  ])('rejects maxMembers %p', async (maxMembers, message) => {
    expect(
      await errorsFor(CreateClubDto, createInput({ maxMembers })),
    ).toContain(message);
  });

  it('normalizes the username and tags, and trims rules', async () => {
    const dto = plainToInstance(
      CreateClubDto,
      createInput({
        username: ' @Manila-VB ',
        tags: ['#Weekend', 'weekend', 'Spikers'],
        rules: ['  Be on time  '],
      }),
    );

    expect(await validate(dto)).toEqual([]);
    expect(dto.username).toBe('manila-vb');
    expect(dto.tags).toEqual(['weekend', 'spikers']);
    expect(dto.rules).toEqual(['Be on time']);
  });

  it('checks social links point at the right network', async () => {
    expect(
      await errorsFor(
        CreateClubDto,
        createInput({
          facebookUrl: 'https://www.facebook.com/club',
          instagramUrl: 'https://instagram.com/club',
          tiktokUrl: 'https://www.tiktok.com/@club',
        }),
      ),
    ).toEqual([]);
    expect(
      await errorsFor(
        CreateClubDto,
        createInput({ instagramUrl: 'https://facebook.com/club' }),
      ),
    ).toContain('Instagram link must be an https://instagram.com/ address.');
  });

  it('rejects usernames with unsafe characters', async () => {
    for (const username of ['has space', 'under_score', '-dash', 'a--b']) {
      expect(
        (await errorsFor(CreateClubDto, createInput({ username }))).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe('UpdateClubDto', () => {
  it('allows partial updates and clearing optional fields', async () => {
    expect(
      await errorsFor(UpdateClubDto, { about: null, contactEmail: '' }),
    ).toEqual([]);
  });

  it('never clears required fields', async () => {
    const errors = await errorsFor(UpdateClubDto, {
      maxMembers: null,
      name: '',
      primarySportId: null,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        'Maximum members is required.',
        'Club name must be at least 2 characters.',
        'Choose a primary sport.',
      ]),
    );
  });
});
