import {
  notificationActor,
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

  it('notifies followers of a new post or reel', () => {
    const post = {
      type: 'publish' as const,
      context: 'post' as const,
      tweetId: 't9',
      storyId: null,
      storyUserId: null
    };
    const reel = {
      type: 'publish' as const,
      context: 'reel' as const,
      tweetId: null,
      storyId: 'reel2',
      storyUserId: null
    };
    expect(notificationHref(post, 'salem')).toBe('/tweet/t9');
    expect(notificationCopy(post)).toBe('نشر منشوراً جديداً');
    expect(notificationHref(reel, 'salem')).toBe('/reels?video=reel2');
    expect(notificationCopy(reel)).toBe('نشر ريلاً جديداً');
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

  it('shows a stored sender name even before the user document loads', () => {
    const actor = notificationActor(
      {
        fromUserId: 'u1',
        fromName: 'سارة',
        fromUsername: 'sara',
        fromPhotoURL: '/photo.png'
      },
      null,
      'المستخدم'
    );
    expect(actor.name).toBe('سارة');
    expect(actor.username).toBe('sara');
    expect(notificationHref({ type: 'follow' }, actor.username, 'u1')).toBe(
      '/user/sara'
    );
  });

  it('falls back to the username or a label instead of an empty name', () => {
    const actor = notificationActor(
      {
        fromUserId: 'u2',
        fromName: 'مستخدم',
        fromUsername: '',
        fromPhotoURL: null
      },
      null,
      'المستخدم'
    );
    expect(actor.name).toBe('المستخدم');
    expect(notificationHref({ type: 'follow' }, '', 'u2')).toBe('/user/u2');
  });
});
