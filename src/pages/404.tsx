import { ThemeContext } from '@lib/context/theme-context';
import { SEO } from '@components/common/seo';
import { useContext } from 'react';
import { tx } from '@lib/i18n/tx';

export default function NotFound(): JSX.Element {
  // The 404 page is statically generated outside the app providers during
  // the build — useTheme would throw and break SSR, so read the context
  // leniently instead.
  const context = useContext(ThemeContext);
  const theme = context?.theme ?? 'dark';

  const isDarkMode = ['dim', 'dark'].includes(theme);

  return (
    <>
      <SEO
        title={tx('err.pageTitle')}
        description={tx('err.pageMissing')}
        image='/404.png'
      />
      <div
        className='flex min-h-app flex-col items-center justify-center gap-4 px-4 text-center'
        style={{ background: isDarkMode ? '#000' : '#fff' }}
      >
        <h1 className='text-4xl font-bold'>٤٠٤</h1>
        <p className='text-xl'>{tx('err.pageMissing')}</p>
      </div>
    </>
  );
}
