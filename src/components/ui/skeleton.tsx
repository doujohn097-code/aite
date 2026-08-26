import cn from 'clsx';

type SkeletonShape = 'pill' | 'circle' | 'bubble' | 'media' | 'none';

type SkeletonProps = {
  className?: string;
  shape?: SkeletonShape;
};

const SHAPE: Record<SkeletonShape, string> = {
  pill: 'rounded-full',
  circle: 'shrink-0 overflow-hidden rounded-full',
  bubble: 'overflow-hidden rounded-[1.25rem]',
  media: 'overflow-hidden rounded-2xl',
  none: ''
};

export function Skeleton({
  className,
  shape = 'pill'
}: SkeletonProps): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse bg-light-secondary/20 dark:bg-dark-secondary/30',
        SHAPE[shape],
        className
      )}
    />
  );
}

export function TweetSkeleton(): JSX.Element {
  return (
    <article className='glass-card flex flex-col gap-y-3 overflow-hidden px-4 py-3'>
      <div className='grid grid-cols-[auto,1fr] gap-x-3'>
        <Skeleton shape='circle' className='h-12 w-12' />
        <div className='flex min-w-0 flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-3.5 w-28' />
            <Skeleton className='h-3 w-16' />
          </div>
          <Skeleton className='h-3 w-full' />
          <Skeleton className='h-3 w-4/5' />
        </div>
      </div>
      <Skeleton
        shape='none'
        className='-mx-4 h-64 w-[calc(100%+2rem)] rounded-none'
      />
      <div className='grid grid-cols-4 py-1'>
        <Skeleton shape='circle' className='mx-auto h-8 w-8' />
        <Skeleton shape='circle' className='mx-auto h-8 w-8' />
        <Skeleton shape='circle' className='mx-auto h-8 w-8' />
        <Skeleton shape='circle' className='mx-auto h-8 w-8' />
      </div>
    </article>
  );
}

export function TweetFeedSkeleton({
  count = 5
}: {
  count?: number;
}): JSX.Element {
  return (
    <div role='status' aria-label='loading'>
      {Array.from({ length: count }, (_, index) => (
        <TweetSkeleton key={index} />
      ))}
    </div>
  );
}

export function NotificationSkeleton(): JSX.Element {
  return (
    <div className='glass-card flex items-center gap-3.5 px-4 py-3.5'>
      <div className='relative shrink-0'>
        <Skeleton shape='circle' className='h-[46px] w-[46px]' />
        <Skeleton
          shape='circle'
          className='absolute -bottom-1 -left-1 h-6 w-6 ring-2 ring-main-background'
        />
      </div>
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <Skeleton className='h-3.5 w-3/4' />
        <Skeleton className='h-3 w-20' />
      </div>
    </div>
  );
}

export function NotificationFeedSkeleton({
  count = 6
}: {
  count?: number;
}): JSX.Element {
  return (
    <div role='status' aria-label='loading'>
      {Array.from({ length: count }, (_, index) => (
        <NotificationSkeleton key={index} />
      ))}
    </div>
  );
}

export function UserRowSkeleton(): JSX.Element {
  return (
    <div className='glass-card grid grid-cols-[auto,1fr] gap-3 px-4 py-3'>
      <Skeleton shape='circle' className='h-12 w-12' />
      <div className='flex items-center justify-between gap-2'>
        <div className='flex min-w-0 flex-col gap-2'>
          <Skeleton className='h-3.5 w-32' />
          <Skeleton className='h-3 w-20' />
        </div>
        <Skeleton className='h-8 w-20 rounded-full' />
      </div>
    </div>
  );
}

export function UserFeedSkeleton({
  count = 6
}: {
  count?: number;
}): JSX.Element {
  return (
    <div role='status' aria-label='loading'>
      {Array.from({ length: count }, (_, index) => (
        <UserRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function ConversationRowSkeleton(): JSX.Element {
  return (
    <div className='glass-card flex items-center gap-3 px-4 py-3'>
      <Skeleton shape='circle' className='h-12 w-12' />
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-3.5 w-28' />
          <Skeleton className='h-3 w-10' />
        </div>
        <Skeleton className='h-3 w-2/3' />
      </div>
    </div>
  );
}

export function ConversationFeedSkeleton({
  count = 6
}: {
  count?: number;
}): JSX.Element {
  return (
    <div role='status' aria-label='loading'>
      {Array.from({ length: count }, (_, index) => (
        <ConversationRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function MessageThreadSkeleton(): JSX.Element {
  return (
    <div
      role='status'
      aria-label='loading'
      className='flex flex-1 flex-col justify-end gap-3 py-2'
    >
      <div className='flex items-end gap-2'>
        <Skeleton shape='circle' className='h-8 w-8' />
        <Skeleton shape='bubble' className='h-11 w-44 rounded-bl-md' />
      </div>
      <div className='flex items-end gap-2'>
        <Skeleton shape='circle' className='h-8 w-8' />
        <Skeleton shape='bubble' className='h-16 w-56 rounded-bl-md' />
      </div>
      <div className='flex justify-end'>
        <Skeleton shape='bubble' className='h-11 w-40 rounded-br-md' />
      </div>
      <div className='flex justify-end'>
        <Skeleton shape='media' className='h-36 w-44 rounded-br-md' />
      </div>
      <div className='flex items-end gap-2'>
        <Skeleton shape='circle' className='h-8 w-8' />
        <Skeleton shape='bubble' className='h-10 w-32 rounded-bl-md' />
      </div>
      <div className='flex justify-end'>
        <Skeleton shape='bubble' className='h-12 w-52 rounded-br-md' />
      </div>
    </div>
  );
}

export function ProfileSkeleton(): JSX.Element {
  return (
    <div role='status' aria-label='loading'>
      <Skeleton shape='none' className='h-36 w-full xs:h-48 sm:h-52' />
      <div className='glass-panel glass-strong relative flex flex-col gap-3 px-4 py-3'>
        <div className='grid grid-cols-[auto,1fr] items-start gap-3'>
          <Skeleton
            shape='circle'
            className='-mt-3 h-24 w-24 -translate-y-1/2 ring-4 ring-main-background xs:h-32 xs:w-32 sm:h-36 sm:w-36'
          />
          <div className='flex flex-wrap items-center justify-end gap-2'>
            <Skeleton className='h-8 w-20 rounded-full' />
            <Skeleton className='h-8 w-24 rounded-full' />
          </div>
        </div>
        <Skeleton className='h-5 w-36' />
        <Skeleton className='h-3 w-24' />
        <Skeleton className='mt-2 h-3 w-full' />
        <Skeleton className='h-3 w-2/3' />
      </div>
    </div>
  );
}

export function ReelSkeleton(): JSX.Element {
  return (
    <div
      role='status'
      aria-label='loading'
      className='relative h-full w-full overflow-hidden bg-black'
    >
      <div className='absolute inset-0 animate-pulse bg-white/10' />
      <div className='absolute bottom-24 left-4 flex flex-col items-center gap-4'>
        <Skeleton shape='circle' className='h-10 w-10 bg-white/20' />
        <Skeleton shape='circle' className='h-10 w-10 bg-white/20' />
        <Skeleton shape='circle' className='h-10 w-10 bg-white/20' />
      </div>
      <div className='absolute bottom-10 right-4 flex flex-col items-end gap-2'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-3.5 w-24 bg-white/20' />
          <Skeleton shape='circle' className='h-10 w-10 bg-white/20' />
        </div>
        <Skeleton className='h-3 w-40 bg-white/20' />
      </div>
    </div>
  );
}

export function StoryChipSkeleton(): JSX.Element {
  return (
    <div className='flex shrink-0 flex-col items-center gap-1.5'>
      <Skeleton shape='circle' className='h-14 w-14' />
      <Skeleton className='h-2.5 w-10' />
    </div>
  );
}
