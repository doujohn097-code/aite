import {
  buildChromeIntentUrl,
  buildChromeNavigateUrl,
  filenameFromMedia,
  isAllowedMediaDownloadUrl,
  isEmbeddedAndroidApp
} from '../media-download';

describe('media download allowlist', () => {
  it('allows Cloudflare R2 public hosts and rejects others', () => {
    expect(
      isAllowedMediaDownloadUrl(
        'https://pub-ac6ca2c23fe44a8c93e7a74791c80260.r2.dev/media/u1/pic.jpg'
      )
    ).toBe(true);
    expect(
      isAllowedMediaDownloadUrl(
        'https://account.r2.cloudflarestorage.com/bucket/file.mp4'
      )
    ).toBe(true);
    expect(isAllowedMediaDownloadUrl('https://evil.example/pic.jpg')).toBe(
      false
    );
    expect(isAllowedMediaDownloadUrl('http://127.0.0.1/secret')).toBe(false);
    expect(isAllowedMediaDownloadUrl('not-a-url')).toBe(false);
  });
});

describe('media download filename', () => {
  it('keeps a sane name and adds an extension when needed', () => {
    expect(
      filenameFromMedia('https://cdn.example/a/photo.png', 'غروب', 'image/png')
    ).toBe('غروب.png');
    expect(
      filenameFromMedia(
        'https://cdn.example/clip.mp4',
        'holiday/clip',
        'video/mp4'
      )
    ).toBe('clip.mp4');
  });
});

describe('android chrome handoff', () => {
  it('detects the native Android shell and builds Chrome URLs', () => {
    expect(isEmbeddedAndroidApp('Mozilla/5.0 (Windows NT 10.0)', { capacitor: false, aiteBridge: false })).toBe(false);
    expect(
      isEmbeddedAndroidApp(
        'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        { capacitor: false, aiteBridge: false }
      )
    ).toBe(true);
    expect(
      isEmbeddedAndroidApp('Mozilla/5.0 (Linux; Android 14)', { capacitor: true })
    ).toBe(true);

    const file =
      'https://aite-app-one.vercel.app/api/media/download?ticket=abc.def';
    expect(buildChromeNavigateUrl(file)).toBe(
      `googlechrome://navigate?url=${encodeURIComponent(file)}`
    );
    expect(buildChromeIntentUrl(file)).toContain('package=com.android.chrome');
    expect(buildChromeIntentUrl(file)).toContain('intent://aite-app-one.vercel.app/');
  });
});
