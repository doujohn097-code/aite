import { extractMentions, isMentionToken } from '../mention-parser';

describe('mention parser', () => {
  it('extracts unique normalized usernames', () => {
    expect(extractMentions('مرحبًا @Salem و @john_12 ثم @salem')).toEqual([
      'salem',
      'john_12'
    ]);
  });

  it('does not treat email addresses or malformed values as mentions', () => {
    expect(extractMentions('mail a@user.com و @@admin و @ab')).toEqual([]);
  });

  it('limits a single piece of content to ten mentions', () => {
    const text = Array.from({ length: 15 }, (_, i) => `@user_${i}`).join(' ');
    expect(extractMentions(text)).toHaveLength(10);
  });

  it('validates mention tokens', () => {
    expect(isMentionToken('@valid_user')).toBe(true);
    expect(isMentionToken('@غير_صالح')).toBe(false);
  });
});
