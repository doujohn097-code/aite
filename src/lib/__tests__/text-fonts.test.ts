import {
  DEFAULT_TEXT_FONT,
  fontsByGroup,
  fontCss,
  isLastOwnInStreak,
  isTextFontId,
  TEXT_FONTS
} from '../text-fonts';

describe('text fonts', () => {
  it('resolves known fonts and groups a read streak', () => {
    expect(isTextFontId('cairo')).toBe(true);
    expect(isTextFontId('unknown')).toBe(false);
    expect(fontCss('playfair')).toContain('Playfair');
    expect(fontCss(null)).toContain('IBM Plex');
    expect(fontCss(DEFAULT_TEXT_FONT)).toContain('IBM Plex');
    expect(fontsByGroup('ar').every((font) => font.group === 'ar')).toBe(true);
    expect(fontsByGroup('en').every((font) => font.group === 'en')).toBe(true);
    expect(TEXT_FONTS.some((font) => font.id === 'aite')).toBe(true);
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
    expect(
      isLastOwnInStreak([{ senderId: 'a' }, { senderId: 'a' }], 1, 'a')
    ).toBe(true);
  });
});
