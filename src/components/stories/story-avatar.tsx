import cn from 'clsx';
import { useStoryRing } from '@lib/hooks/useStoryRing';
import { UserAvatar } from '@components/user/user-avatar';
import { StoryRing } from './story-ring';
import type { User } from '@lib/types/user';

type StoryAvatarProps = {
  user: Partial<User> & Pick<User, 'id' | 'name' | 'username' | 'photoURL'>;
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
  const { hasStory, unseen, color } = useStoryRing(user);
  const ringColor = color ?? '#3b82f6';
  const photoSize = hasStory ? Math.max(24, size - 10) : size;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-full',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ width: size, height: size }}
    >
      {hasStory && (
        <StoryRing
          color={ringColor}
          animate={unseen}
          className={cn(
            'pointer-events-none absolute inset-0',
            !unseen && 'opacity-45'
          )}
        />
      )}
      <UserAvatar
        src={user.photoURL}
        alt={user.name}
        username={onClick ? undefined : user.username}
        size={photoSize}
      />
    </Wrapper>
  );
}
