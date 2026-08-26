import {
  BIO_TEXT_MAX,
  CAPTION_TEXT_MAX,
  COMMENT_TEXT_MAX,
  CONTENT_STORE_MAX,
  MESSAGE_TEXT_MAX,
  POST_TEXT_MAX,
  POST_TEXT_MAX_ADMIN,
  postTextMax
} from '../text-limits';

describe('text limits', () => {
  it('gives regular posts more room than the old 280 cap', () => {
    expect(POST_TEXT_MAX).toBeGreaterThan(280);
    expect(POST_TEXT_MAX).toBeLessThanOrEqual(1000);
    expect(postTextMax(false)).toBe(POST_TEXT_MAX);
    expect(postTextMax(true)).toBe(POST_TEXT_MAX_ADMIN);
  });

  it('keeps comments, captions and messages below the store ceiling', () => {
    expect(COMMENT_TEXT_MAX).toBeGreaterThan(280);
    expect(COMMENT_TEXT_MAX).toBeLessThanOrEqual(CONTENT_STORE_MAX);
    expect(CAPTION_TEXT_MAX).toBeLessThanOrEqual(CONTENT_STORE_MAX);
    expect(MESSAGE_TEXT_MAX).toBeGreaterThan(4000);
    expect(BIO_TEXT_MAX).toBeGreaterThan(160);
  });
});
