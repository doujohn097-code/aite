import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@lib/context/language-context';
import { getSavedAccounts } from '@lib/accounts';
import { UserAvatar } from '@components/user/user-avatar';
import type { SavedAccount } from '@lib/accounts';

type SavedAccountsStripProps = {
  onPick: (account: SavedAccount) => void;
};

export function SavedAccountsStrip({
  onPick
}: SavedAccountsStripProps): JSX.Element | null {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    setAccounts(getSavedAccounts());
  }, []);

  if (!accounts.length) return null;

  return (
    <div className='flex w-full flex-col gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-xs font-bold text-light-secondary dark:text-dark-secondary'>
          {t('accounts.savedShort')}
        </p>
        <Link href='/accounts'>
          <a className='text-xs font-bold text-main-accent-text hover:underline'>
            {t('accounts.manage')}
          </a>
        </Link>
      </div>
      <div className='flex gap-2 overflow-x-auto pb-1'>
        {accounts.map((account) => (
          <button
            key={account.username}
            type='button'
            onClick={(): void => onPick(account)}
            className='flex min-w-[7.5rem] max-w-[8.5rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-light-border bg-main-background px-2 py-2.5 text-center transition hover:border-main-accent/50 hover:bg-light-primary/[0.04] dark:border-dark-border dark:hover:bg-white/[0.04]'
          >
            <UserAvatar
              src={account.photoURL || '/assets/default-avatar.png'}
              alt={account.name}
              username={account.username}
              size={40}
              showPresence={false}
            />
            <span className='w-full truncate text-[11px] font-bold leading-tight'>
              {account.name || account.username}
            </span>
            <span className='w-full truncate text-[10px] text-light-secondary dark:text-dark-secondary'>
              @{account.username}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
