import { fontCss, isLastOwnInStreak, isTextFontId } from '../text-fonts';

describe('text fonts', () => {
  it('resolves known fonts and groups a read streak', () => {
    expect(isTextFontId('cairo')).toBe(true);
    expect(isTextFontId('unknown')).toBe(false);
    expect(fontCss('playfair')).toContain('Playfair');
    expect(fontCss(null)).toContain('IBM Plex');
    expect(
      isLastOwnInStreak(
        [{ senderId: 'a' }, { senderId: 'a' }, { senderId: 'b' }],
        1,
        'a'
      )
    ).toBe(true);
    expect(
      isLastOwnInStreak(
        [{ senderId: 'a' }, { senderId: 'a' }, { senderId: 'b' }],
        0,
        'a'
      )
    ).toBe(false);
  });
});
