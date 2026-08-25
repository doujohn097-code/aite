import {
  filenameFromMedia,
  isAllowedMediaDownloadUrl
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
