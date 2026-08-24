import Link from 'next/link';
import { useLanguage } from '@lib/context/language-context';

export function AsideFooter(): JSX.Element {
  const { t } = useLanguage();
  const footerLinks = [
    [t('nav.people'), '/search'],
    [t('nav.reels'), '/reels'],
    [t('action.explore'), '/home']
  ] as const;

  return (
    <footer
      className='sticky top-16 flex flex-col gap-3 text-center text-sm
                 text-light-secondary dark:text-dark-secondary'
    >
      <nav className='flex flex-wrap justify-center gap-2'>
        {footerLinks.map(([linkName, href]) => (
          <Link href={href} key={href}>
            <a className='custom-underline'>{linkName}</a>
          </Link>
        ))}
      </nav>
      <p>© 2026 Aite</p>
    </footer>
  );
}
