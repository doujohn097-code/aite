import {
  extractBareProfileHandle,
  extractProfileHandle,
  extractProfileHandleFromPath
} from '../profile-link';

describe('profile link parsing', () => {
  it('reads a /user path', () => {
    expect(extractProfileHandleFromPath('/user/salem_125')).toBe('salem_125');
    expect(extractProfileHandleFromPath('/user/salem_125/followers')).toBe(
      'salem_125'
    );
    expect(extractProfileHandleFromPath('/tweet/abc')).toBeNull();
  });

  it('accepts live and preview Aite URLs', () => {
    expect(
      extractProfileHandle('https://aite-app-one.vercel.app/user/sara_12')
    ).toBe('sara_12');
    expect(extractProfileHandle('www.example.com/user/sara_12?ref=1')).toBe(
      'sara_12'
    );
    expect(extractProfileHandle('/user/sara_12')).toBe('sara_12');
  });

  it('only treats a lone URL as a bare profile link', () => {
    expect(
      extractBareProfileHandle('https://aite-app-one.vercel.app/user/salem')
    ).toBe('salem');
    expect(
      extractBareProfileHandle('شوف https://aite-app-one.vercel.app/user/salem')
    ).toBeNull();
  });
});
