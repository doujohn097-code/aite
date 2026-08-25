import { firstStrongDir, textDir, userTextDirAttr } from '../text-direction';

describe('text direction', () => {
  it('follows the first strong letter and ignores urls or mentions', () => {
    expect(firstStrongDir('Hello world')).toBe('ltr');
    expect(firstStrongDir('مرحبا بالعالم')).toBe('rtl');
    expect(firstStrongDir('Hello مرحبا')).toBe('ltr');
    expect(firstStrongDir('مرحبا Hello')).toBe('rtl');
    expect(firstStrongDir('https://aite.app Hello')).toBe('ltr');
    expect(firstStrongDir('@salem مرحبا')).toBe('rtl');
    expect(firstStrongDir('123 !!!')).toBe(null);
    expect(textDir('', 'ltr')).toBe('ltr');
    expect(userTextDirAttr('Good morning')).toBe('ltr');
    expect(userTextDirAttr('صباح الخير')).toBe('rtl');
  });
});
