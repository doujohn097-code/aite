import cn from 'clsx';
import { useStoryRing } from '@lib/hooks/useStoryRing';
import { UserAvatar } from '@components/user/user-avatar';
import type { User } from '@lib/types/user';

type StoryAvatarProps = {
  user: Partial<User> &
    Pick<User, 'id' | 'name' | 'username' | 'photoURL'>;
  size?: number;
  className?: string;
  onClick?: () => void;
};

export function StoryAvatar({
  user,
  size = 48,
  className,
  onClick
}: StoryAvatarProps): JSX.Element {
  const { hasStory, color } = useStoryRing(user);
  const ringColor = color ?? '#3b82f6';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative transition',
        hasStory ? 'overflow-hidden rounded-full p-0.5' : 'rounded-full p-0',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {hasStory && (
        <span
          aria-hidden
          className='story-ring-spin absolute left-1/2 top-1/2 aspect-square w-[220%] -translate-x-1/2 -translate-y-1/2'
          style={{
            background: `conic-gradient(from 0deg, ${ringColor}10, ${ringColor}, ${ringColor}70, ${ringColor}20, ${ringColor}, ${ringColor}10)`
          }}
        />
      )}
      <div className={cn('relative rounded-full bg-main-background', hasStory ? 'p-0.5' : 'p-0')}>
        <UserAvatar
          src={user.photoURL}
          alt={user.name}
          username={onClick ? undefined : user.username}
          size={hasStory ? size - 8 : size}
        />
      </div>
    </Wrapper>
  );
}
