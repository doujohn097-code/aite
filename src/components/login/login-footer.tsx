import { useLanguage } from '@lib/context/language-context';

export function LoginFooter(): JSX.Element {
  const { t } = useLanguage();
  return (
    <footer
      className='hidden justify-center p-4 text-sm text-light-secondary
                 dark:text-dark-secondary lg:flex'
    >
      <p>{t('seo.copyright')}</p>
    </footer>
  );
}
