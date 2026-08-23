import { SWRConfig } from 'swr';
import { Toaster } from 'react-hot-toast';
import { fetchJSON } from '@lib/fetch';
import { WindowContextProvider } from '@lib/context/window-context';
import { Sidebar } from '@components/sidebar/sidebar';
import { OnboardingModal } from '@components/modal/onboarding-modal';
import type { DefaultToastOptions } from 'react-hot-toast';
import type { LayoutProps } from './common-layout';

const toastOptions: DefaultToastOptions = {
  className: 'aite-toast',
  style: {
    color: 'rgb(var(--toast-text))',
    borderRadius: '14px',
    fontWeight: 600,
    border: '1px solid rgb(var(--main-accent) / 0.25)',
    backgroundColor: 'rgb(var(--toast-bg) / 0.92)',
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    boxShadow: '0 12px 40px rgb(0 0 0 / 0.28)',
    maxWidth: '92vw'
  },
  success: { duration: 4000 }
};

export function MainLayout({ children }: LayoutProps): JSX.Element {
  return (
    <div className='flex w-full justify-center gap-0 lg:gap-4'>
      <WindowContextProvider>
        <Sidebar />
        <SWRConfig value={{ fetcher: fetchJSON }}>{children}</SWRConfig>
      </WindowContextProvider>
      <OnboardingModal />
      <Toaster
        position='bottom-center'
        toastOptions={toastOptions}
        containerClassName='mb-12 xs:mb-0'
      />
    </div>
  );
}
