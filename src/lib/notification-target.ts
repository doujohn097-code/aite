import { translate, type MessageKey } from './i18n';
import { tx } from './i18n/tx';
import { profileHref, resolveProfileName, resolveUsername } from './utils';
import type { Notification } from './types/notification';
import type { User } from './types/user';

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

export function notificationActor(
  notification: Pick<
    Notification,
    'fromUserId' | 'fromName' | 'fromUsername' | 'fromPhotoURL'
  >,
  user?: User | null,
  fallbackName = ''
): {
  id: string;
  name: string;
  username: string;
  photoURL: string;
  href: string;
} {
  const name =
    resolveProfileName(user) ||
    resolveProfileName(
      {
        name: notification.fromName,
        username: notification.fromUsername
      },
      fallbackName
    );
  const username =
    resolveUsername(user) ||
    resolveUsername({ username: notification.fromUsername }) ||
    '';
  const photoURL =
    user?.photoURL || notification.fromPhotoURL || '/assets/default-avatar.png';
  const id = user?.id || notification.fromUserId || '';
  return {
    id,
    name,
    username,
    photoURL,
    href: profileHref({ id, username }, '/notifications')
  };
}

export function notificationHref(
  notification: Pick<
    Notification,
    'type' | 'context' | 'tweetId' | 'storyId' | 'storyUserId'
  >,
  fromUsername: string,
  fromUserId?: string
): string {
  if (notification.type === 'follow')
    return fromUsername
      ? `/user/${fromUsername}`
      : fromUserId
      ? `/user/${fromUserId}`
      : '/home';

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
  notification: Pick<Notification, 'type' | 'context' | 'storyId' | 'tweetId'>,
  t?: (key: MessageKey) => string
): string {
  const text = t ?? ((key) => translate('ar', key));
  const context = resolveNotificationContext(notification);

  switch (notification.type) {
    case 'follow':
      return text('notif.follow');
    case 'like':
      return context === 'reel'
        ? text('notif.likeReel')
        : text('notif.likePost');
    case 'retweet':
      return text('notif.retweet');
    case 'reply':
      return context === 'reel'
        ? text('notif.replyReel')
        : text('notif.replyPost');
    case 'storyLike':
      return context === 'reel'
        ? text('notif.likeReel')
        : text('notif.storyLike');
    case 'mention':
      return context === 'reel'
        ? text('notif.mentionReel')
        : context === 'story'
        ? text('notif.mentionStory')
        : text('notif.mentionPost');
    case 'publish':
      return context === 'reel'
        ? text('notif.publishReel')
        : text('notif.publishPost');
    default:
      return text('notif.generic');
  }
}

export function notificationPushCopy(
  type: Notification['type'],
  context: NotificationContext | null,
  senderName: string
): { title: string; body: string } {
  const name = senderName;
  switch (type) {
    case 'follow':
      return {
        title: tx('notif.pushFollowTitle'),
        body: tx('notif.pushFollowBody', { name })
      };
    case 'like':
      return context === 'reel'
        ? {
            title: tx('notif.pushLikeReelTitle'),
            body: tx('notif.pushLikeReelBody', { name })
          }
        : {
            title: tx('notif.pushLikeTitle'),
            body: tx('notif.pushLikeBody', { name })
          };
    case 'retweet':
      return {
        title: tx('notif.pushRepostTitle'),
        body: tx('notif.pushRepostBody', { name })
      };
    case 'reply':
      return context === 'reel'
        ? {
            title: tx('notif.pushReplyTitle'),
            body: tx('notif.pushReplyReelBody', { name })
          }
        : {
            title: tx('notif.pushReplyTitle'),
            body: tx('notif.pushReplyBody', { name })
          };
    case 'storyLike':
      return context === 'reel'
        ? {
            title: tx('notif.pushLikeReelTitle'),
            body: tx('notif.pushLikeReelBody', { name })
          }
        : {
            title: tx('notif.pushStoryTitle'),
            body: tx('notif.pushStoryBody', { name })
          };
    case 'mention':
      return context === 'reel'
        ? {
            title: tx('notif.pushMentionTitle'),
            body: tx('notif.pushMentionReel', { name })
          }
        : context === 'story'
        ? {
            title: tx('notif.pushMentionTitle'),
            body: tx('notif.pushMentionStory', { name })
          }
        : {
            title: tx('notif.pushMentionTitle'),
            body: tx('notif.pushMentionPost', { name })
          };
    case 'publish':
      return context === 'reel'
        ? {
            title: tx('notif.pushPublishReelTitle'),
            body: tx('notif.pushPublishReelBody', { name })
          }
        : {
            title: tx('notif.pushPublishPostTitle'),
            body: tx('notif.pushPublishPostBody', { name })
          };
    default:
      return { title: 'Aite', body: tx('notif.pushGenericBody', { name }) };
  }
}
