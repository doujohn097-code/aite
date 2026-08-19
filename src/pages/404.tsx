import { useTheme } from '@lib/context/theme-context';
import { SEO } from '@components/common/seo';

export default function NotFound(): JSX.Element {
  const { theme } = useTheme();

  const isDarkMode = ['dim', 'dark'].includes(theme);

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
