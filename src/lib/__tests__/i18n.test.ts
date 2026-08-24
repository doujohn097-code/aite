import { localeDir, translate } from '../i18n';

describe('i18n', () => {
  it('maps locales to the correct document direction', () => {
    expect(localeDir('ar')).toBe('rtl');
    expect(localeDir('en')).toBe('ltr');
    expect(localeDir('fr')).toBe('ltr');
  });

  it('interpolates parameters and keeps the same keys across catalogs', () => {
    expect(translate('en', 'tweet.follow', { username: 'salem' })).toBe(
      'Follow @salem'
    );
    expect(translate('fr', 'tweet.follow', { username: 'salem' })).toBe(
      'Suivre @salem'
    );
    expect(translate('ar', 'tweet.follow', { username: 'salem' })).toContain(
      'salem'
    );
  });
});
