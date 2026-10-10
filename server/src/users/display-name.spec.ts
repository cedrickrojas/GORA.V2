import { formatDisplayName } from './display-name';

describe('formatDisplayName', () => {
  it('joins first and last name', () => {
    expect(
      formatDisplayName({
        username: 'louis',
        firstName: 'Louis',
        lastName: 'Tabernero',
      }),
    ).toBe('Louis Tabernero');
  });

  it('uses whichever name is available', () => {
    expect(
      formatDisplayName({
        username: 'louis',
        firstName: ' Louis ',
        lastName: '',
      }),
    ).toBe('Louis');
    expect(
      formatDisplayName({ username: 'louis', firstName: null, lastName: 'T' }),
    ).toBe('T');
  });

  it('falls back to the username', () => {
    expect(
      formatDisplayName({ username: 'louis', firstName: ' ', lastName: null }),
    ).toBe('louis');
  });
});
