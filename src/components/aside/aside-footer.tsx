import Link from 'next/link';

const footerLinks = [
  ['الأشخاص', '/search'],
  ['الريلز', '/reels'],
  ['استكشاف', '/home']
] as const;

export function AsideFooter(): JSX.Element {
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
