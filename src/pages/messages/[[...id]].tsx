import type { ReactElement, ReactNode } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { SEO } from '@components/common/seo';
import { HeroIcon } from '@components/ui/hero-icon';

export default function Messages(): JSX.Element {
  return (
    <MainContainer className='h-full min-h-0 overflow-hidden'>
      <SEO title='الرسائل / Aite' />
      <MainHeader title='الرسائل' useMobileSidebar />
      <div className='flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center'>
        <HeroIcon className='h-16 w-16 text-light-secondary dark:text-dark-secondary' iconName='EnvelopeIcon' />
        <p className='text-2xl font-bold'>قريبًا</p>
        <p className='text-light-secondary dark:text-dark-secondary'>
          سيتوفر صندوق الرسائل قريبًا.
        </p>
      </div>
    </MainContainer>
  );
}

Messages.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>{page}</MainLayout>
  </ProtectedLayout>
);

export const getStaticPaths: GetStaticPaths = async () => {
  await Promise.resolve();
  return {
    paths: [{ params: { id: [] } }],
    fallback: 'blocking'
  };
};

export const getStaticProps: GetStaticProps = async () => {
  await Promise.resolve();
  return { props: {} };
};
