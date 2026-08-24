import type { Notification } from './types/notification';

export type NotificationContext = 'post' | 'reel' | 'story';

export function resolveNotificationContext(
  notification: Pick<
    Notification,
    'type' | 'context' | 'tweetId' | 'storyId' | 'storyUserId'
  >
): NotificationContext | null {
  if (
    notification.context === 'reel' ||
    notification.context === 'story' ||
    notification.context === 'post'
  )
    return notification.context;

  if (notification.storyId && !notification.storyUserId) return 'reel';
  if (notification.storyId && notification.storyUserId) return 'story';
  if (notification.tweetId) return 'post';
  return null;
}

export function notificationHref(
  notification: Pick<
    Notification,
    'type' | 'context' | 'tweetId' | 'storyId' | 'storyUserId'
  >,
  fromUsername: string
): string {
  if (notification.type === 'follow')
    return fromUsername ? `/user/${fromUsername}` : '/home';

  const context = resolveNotificationContext(notification);

  if (context === 'reel' && notification.storyId)
    return `/reels?video=${notification.storyId}`;

  if (context === 'story' && notification.storyUserId)
    return `/stories/${notification.storyUserId}?storyId=${
      notification.storyId ?? ''
    }`;

  if (notification.tweetId) return `/tweet/${notification.tweetId}`;
  return '/notifications';
}

export function notificationCopy(
  notification: Pick<Notification, 'type' | 'context' | 'storyId' | 'tweetId'>
): string {
  const context = resolveNotificationContext(notification);

  switch (notification.type) {
    case 'follow':
      return 'بدأ بمتابعتك';
    case 'like':
      return context === 'reel' ? 'تفاعل مع الريلز الخاص بك' : 'أعجب بمنشورك';
    case 'retweet':
      return 'أعاد نشر منشورك';
    case 'reply':
      return context === 'reel'
        ? 'علّق على الريلز الخاص بك'
        : 'علّق على منشورك';
    case 'storyLike':
      return context === 'reel' ? 'تفاعل مع الريلز الخاص بك' : 'أعجب بقصتك';
    case 'mention':
      return context === 'reel'
        ? 'أشار إليك في ريلز'
        : context === 'story'
        ? 'أشار إليك في قصة'
        : 'أشار إليك في منشور';
    default:
      return 'تفاعل معك';
  }
}

export function notificationPushCopy(
  type: Notification['type'],
  context: NotificationContext | null,
  senderName: string
): { title: string; body: string } {
  switch (type) {
    case 'follow':
      return { title: 'متابع جديد', body: `قام ${senderName} بمتابعتك` };
    case 'like':
      return context === 'reel'
        ? {
            title: 'تفاعل مع الريلز',
            body: `قام ${senderName} بالتفاعل مع الريلز الخاص بك`
          }
        : {
            title: 'إعجاب',
            body: `قام ${senderName} بالتفاعل مع منشورك`
          };
    case 'retweet':
      return {
        title: 'إعادة نشر',
        body: `قام ${senderName} بإعادة نشر منشورك`
      };
    case 'reply':
      return context === 'reel'
        ? {
            title: 'تعليق جديد',
            body: `قام ${senderName} بالتعليق على الريلز الخاص بك`
          }
        : {
            title: 'تعليق جديد',
            body: `قام ${senderName} بالتعليق على منشورك`
          };
    case 'storyLike':
      return context === 'reel'
        ? {
            title: 'تفاعل مع الريلز',
            body: `قام ${senderName} بالتفاعل مع الريلز الخاص بك`
          }
        : {
            title: 'تفاعل مع قصتك',
            body: `قام ${senderName} بالتفاعل مع قصتك`
          };
    case 'mention':
      return context === 'reel'
        ? {
            title: 'إشارة جديدة',
            body: `أشار إليك ${senderName} في ريلز`
          }
        : context === 'story'
        ? {
            title: 'إشارة جديدة',
            body: `أشار إليك ${senderName} في قصة`
          }
        : {
            title: 'إشارة جديدة',
            body: `أشار إليك ${senderName} في منشور`
          };
    default:
      return { title: 'Aite', body: `قام ${senderName} بالتفاعل معك` };
  }
}
