import {
  notificationCopy,
  notificationHref,
  resolveNotificationContext
} from '../notification-target';

describe('notification targeting', () => {
  it('treats a reel like without storyUserId as a reel', () => {
    const notification = {
      type: 'storyLike' as const,
      storyId: 'reel1',
      storyUserId: null,
      tweetId: null
    };
    expect(resolveNotificationContext(notification)).toBe('reel');
    expect(notificationHref(notification, 'salem')).toBe('/reels?video=reel1');
    expect(notificationCopy(notification)).toBe('تفاعل مع الريلز الخاص بك');
  });

  it('treats a reel comment reply as a reel when context is set', () => {
    const notification = {
      type: 'reply' as const,
      context: 'reel' as const,
      storyId: 'reel9',
      tweetId: 'comment1',
      storyUserId: null
    };
    expect(notificationHref(notification, 'salem')).toBe('/reels?video=reel9');
    expect(notificationCopy(notification)).toBe('علّق على الريلز الخاص بك');
  });

  it('keeps posts pointing at the tweet', () => {
    const notification = {
      type: 'like' as const,
      context: 'post' as const,
      tweetId: 't1',
      storyId: null,
      storyUserId: null
    };
    expect(notificationHref(notification, 'salem')).toBe('/tweet/t1');
    expect(notificationCopy(notification)).toBe('أعجب بمنشورك');
  });
});
