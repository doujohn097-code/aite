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
  const { unseen, color } = useStoryRing(user);
  const ringColor = color ?? '#3b82f6';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative shrink-0 rounded-full transition',
        unseen ? 'p-[2.5px]' : 'p-0',
        onClick && 'cursor-pointer',
        className
      )}
      style={unseen ? { backgroundColor: ringColor } : undefined}
    >
      <div
        className={cn('story-solid rounded-full', unseen ? 'p-[2px]' : 'p-0')}
      >
        <UserAvatar
          src={user.photoURL}
          alt={user.name}
          username={onClick ? undefined : user.username}
          size={unseen ? size - 9 : size}
        />
      </div>
    </Wrapper>
  );
}
