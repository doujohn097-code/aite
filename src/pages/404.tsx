import { ThemeContext } from '@lib/context/theme-context';
import { DARK_LIKE_THEMES } from '@lib/types/theme';
import { SEO } from '@components/common/seo';
import { useContext } from 'react';

export default function NotFound(): JSX.Element {
  // The 404 page is statically generated outside the app providers during
  // the build — useTheme would throw and break SSR, so read the context
  // leniently instead.
  const context = useContext(ThemeContext);
  const theme = context?.theme ?? 'dark';

  const isDarkMode = DARK_LIKE_THEMES.includes(theme);

  return (
    <>
      <SEO
        title='الصفحة غير موجودة / Aite'
        description='عذرًا، لم نتمكن من العثور على الصفحة التي تبحث عنها.'
        image='/404.png'
      />
      <div
        className='flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center'
        style={{ background: isDarkMode ? '#000' : '#fff' }}
      >
        <h1 className='text-4xl font-bold'>٤٠٤</h1>
        <p className='text-xl'>الصفحة غير موجودة</p>
      </div>
    </>
  );
}
