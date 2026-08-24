import cn from 'clsx';

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps): JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block animate-pulse rounded-md bg-light-secondary/20 dark:bg-dark-secondary/30',
        className
      )}
    />
  );
}

export function TweetSkeleton(): JSX.Element {
  return (
    <article className='border-b border-light-border px-4 py-3 dark:border-dark-border'>
      <div className='grid grid-cols-[auto,1fr] gap-x-3'>
        <Skeleton className='h-12 w-12 rounded-full' />
        <div className='flex min-w-0 flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-4 w-28' />
            <Skeleton className='h-3 w-16' />
          </div>
          <Skeleton className='h-3 w-full' />
          <Skeleton className='h-3 w-4/5' />
          <Skeleton className='mt-1 h-36 w-full rounded-2xl' />
        </div>
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
    <div role='status' aria-label='جارٍ التحميل'>
      {Array.from({ length: count }, (_, index) => (
        <TweetSkeleton key={index} />
      ))}
    </div>
  );
}

export function NotificationSkeleton(): JSX.Element {
  return (
    <div className='flex items-center gap-3.5 border-b border-light-border/60 px-4 py-3.5 dark:border-dark-border/60'>
      <Skeleton className='h-11 w-11 rounded-full' />
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
    <div role='status' aria-label='جارٍ التحميل'>
      {Array.from({ length: count }, (_, index) => (
        <NotificationSkeleton key={index} />
      ))}
    </div>
  );
}

export function UserRowSkeleton(): JSX.Element {
  return (
    <div className='flex items-center gap-3 px-4 py-3'>
      <Skeleton className='h-12 w-12 rounded-full' />
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='h-3 w-20' />
      </div>
      <Skeleton className='h-8 w-20 rounded-full' />
    </div>
  );
}

export function UserFeedSkeleton({
  count = 6
}: {
  count?: number;
}): JSX.Element {
  return (
    <div role='status' aria-label='جارٍ التحميل'>
      {Array.from({ length: count }, (_, index) => (
        <UserRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function ConversationRowSkeleton(): JSX.Element {
  return (
    <div className='flex items-center gap-3 border-b border-light-border/60 px-4 py-3 dark:border-dark-border/60'>
      <Skeleton className='h-12 w-12 rounded-full' />
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-4 w-28' />
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
    <div role='status' aria-label='جارٍ التحميل'>
      {Array.from({ length: count }, (_, index) => (
        <ConversationRowSkeleton key={index} />
      ))}
    </div>
  );
}

export function ProfileSkeleton(): JSX.Element {
  return (
    <div role='status' aria-label='جارٍ التحميل'>
      <Skeleton className='h-36 w-full rounded-none' />
      <div className='px-4 py-3'>
        <Skeleton className='-mt-10 h-20 w-20 rounded-full' />
        <Skeleton className='mt-4 h-5 w-36' />
        <Skeleton className='mt-2 h-3 w-24' />
        <Skeleton className='mt-4 h-3 w-full' />
        <Skeleton className='mt-2 h-3 w-2/3' />
      </div>
    </div>
  );
}

export function ReelSkeleton(): JSX.Element {
  return (
    <div
      role='status'
      aria-label='جارٍ التحميل'
      className='relative h-full w-full bg-black'
    >
      <div className='absolute inset-0 animate-pulse bg-white/10' />
      <div className='absolute bottom-10 right-4 flex flex-col items-end gap-2'>
        <Skeleton className='h-10 w-10 rounded-full bg-white/20' />
        <Skeleton className='h-3 w-24 bg-white/20' />
        <Skeleton className='h-3 w-40 bg-white/20' />
      </div>
    </div>
  );
}
