import { createHash } from 'crypto';
import { accountMatchesSession } from '../saved-account';
import { usernameToInternalEmail } from '../utils';

describe('saved account matching', () => {
  it('matches the current profile or internal email', () => {
    expect(accountMatchesSession('Salem', 'salem', null)).toBe(true);
    expect(accountMatchesSession('salem', 'other', null)).toBe(false);
    expect(
      accountMatchesSession('salem', null, usernameToInternalEmail('salem'))
    ).toBe(true);
  });
});

describe('device session hash', () => {
  it('hashes a token with sha256 hex', () => {
    const token = 'abc';
    expect(createHash('sha256').update(token).digest('hex')).toHaveLength(64);
  });
});
