import { SEO } from './seo';
import { TweetFeedSkeleton } from '@components/ui/skeleton';

export function Placeholder(): JSX.Element {
  return (
    <main className='mx-auto min-h-app w-full max-w-xl bg-main-background'>
      <SEO
        title='Aite'
        description='شارك أفكارك وتابع الآخرين في Aite.'
        image='/home.png'
      />
      <div className='border-b border-light-border px-4 py-3 dark:border-dark-border'>
        <div className='h-6 w-20 animate-pulse rounded bg-light-secondary/20 dark:bg-dark-secondary/30' />
      </div>
      <TweetFeedSkeleton />
    </main>
  );
}
