import cn from 'clsx';
import { useStoryRing } from '@lib/hooks/useStoryRing';
import { UserAvatar } from '@components/user/user-avatar';
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
  const { hasStory, color } = useStoryRing(user);
  const ringColor = color ?? '#3b82f6';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative rounded-full transition',
        hasStory ? 'p-[3px]' : 'p-0',
        onClick && 'cursor-pointer',
        className
      )}
      style={
        hasStory
          ? {
              background: `linear-gradient(135deg, ${ringColor}, ${ringColor}90 45%, ${ringColor}60)`
            }
          : undefined
      }
    >
      <div
        className={cn(
          'rounded-full bg-main-background',
          hasStory ? 'p-[2px]' : 'p-0'
        )}
      >
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
