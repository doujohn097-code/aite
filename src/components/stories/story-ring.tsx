import cn from 'clsx';
import { STORY_RING_MAIN_PATH, STORY_RING_TAIL_PATH } from '@lib/wavy-circle';

type StoryRingProps = {
  color: string;
  animate?: boolean;
  className?: string;
};

/**
 * Google Play / Material 3 Expressive wavy progress ring.
 * Used as the unseen-story indicator around avatars.
 */
export function StoryRing({
  color,
  animate = true,
  className
}: StoryRingProps): JSX.Element {
  return (
    <svg
      className={cn('story-ring', animate && 'story-ring--live', className)}
      viewBox='0 0 100 100'
      fill='none'
      aria-hidden
      focusable='false'
    >
      <g className='story-ring__spin'>
        <path
          className='story-ring__stroke'
          d={STORY_RING_MAIN_PATH}
          stroke={color}
          strokeWidth={2.85}
          strokeLinecap='round'
          strokeLinejoin='round'
        />
        <path
          className='story-ring__stroke'
          d={STORY_RING_TAIL_PATH}
          stroke={color}
          strokeWidth={2.85}
          strokeLinecap='round'
        />
      </g>
    </svg>
  );
}
