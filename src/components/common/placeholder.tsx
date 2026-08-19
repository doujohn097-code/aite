import { CustomIcon } from '@components/ui/custom-icon';
import { SEO } from './seo';

export function Placeholder(): JSX.Element {
  return (
    <main className='flex min-h-screen items-center justify-center bg-main-background'>
      <SEO
        title='Aite'
        description='شارك أفكارك وتابع الآخرين في Aite.'
        image='/home.png'
      />
      <div className='flex items-center justify-center'>
        <CustomIcon
          className='h-24 w-24 select-none object-contain'
          iconName='AiteIcon'
        />
      </div>
    </main>
  );
}
