import cn from 'clsx';
import { useReducedMotion } from 'framer-motion';
import { useStoryRingFrame } from '@lib/story-ring-clock';
import { STORY_RING_PHASE_PATHS } from '@lib/wavy-circle';

type StoryRingProps = {
  color: string;
  animate?: boolean;
  className?: string;
};

/**
 * Full Google Play / Material 3 wavy circle around a photo.
 * The path phase crawls — the ring does not rigidly spin.
 */
export function StoryRing({
  color,
  animate = true,
  className
}: StoryRingProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const live = Boolean(animate && !reduceMotion);
  const frame = useStoryRingFrame(live);
  const d = STORY_RING_PHASE_PATHS[frame] ?? STORY_RING_PHASE_PATHS[0];

  return (
    <svg
      className={cn('story-ring', live && 'story-ring--live', className)}
      viewBox='0 0 100 100'
      fill='none'
      aria-hidden
      focusable='false'
    >
      <path
        className='story-ring__stroke'
        d={d}
        stroke={color}
        strokeWidth={3.05}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}
