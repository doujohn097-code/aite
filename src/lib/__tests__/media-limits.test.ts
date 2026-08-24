import {
  inferMediaType,
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  maxUploadBytesForType,
  normalizeMediaType,
  uploadTimeoutMs
} from '../media-limits';

describe('media upload limits', () => {
  it('normalizes MIME parameters used by Android MediaRecorder', () => {
    expect(normalizeMediaType('audio/webm;codecs=opus')).toBe('audio/webm');
  });

  it('infers missing Android picker MIME types from file names', () => {
    expect(inferMediaType('camera.mp4', '')).toBe('video/mp4');
    expect(inferMediaType('recording.m4a', 'application/octet-stream')).toBe(
      'audio/mp4'
    );
  });

  it('uses separate limits for images, videos, and audio', () => {
    expect(maxUploadBytesForType('image/jpeg')).toBe(MAX_IMAGE_UPLOAD_BYTES);
    expect(maxUploadBytesForType('video/mp4')).toBe(MAX_VIDEO_UPLOAD_BYTES);
    expect(maxUploadBytesForType('audio/webm')).toBe(MAX_AUDIO_UPLOAD_BYTES);
  });

  it('gives large mobile uploads more time without exceeding 15 minutes', () => {
    expect(uploadTimeoutMs(1024)).toBeGreaterThanOrEqual(180_000);
    expect(uploadTimeoutMs(MAX_VIDEO_UPLOAD_BYTES)).toBeLessThanOrEqual(
      15 * 60_000
    );
  });
});
