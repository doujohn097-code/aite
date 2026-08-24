import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { usersCollection } from '@lib/firebase/collections';
import { useAuth } from '@lib/context/auth-context';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { VerifiedBadge } from '@components/ui/verified-badge';
import { Button } from '@components/ui/button';
import type { User } from '@lib/types/user';
import { useLanguage } from '@lib/context/language-context';

const MAX_SHARE_RECIPIENTS = 20;

type NewMessageModalProps = {
  closeModal: () => void;
  onSelect: (user: User) => void | Promise<void>;
  multiSelect?: boolean;
  onSelectMany?: (users: User[]) => void | Promise<void>;
  title?: string;
};

export function NewMessageModal({
  closeModal,
  onSelect,
  multiSelect = false,
  onSelectMany,
  title
}: NewMessageModalProps): JSX.Element {
  const { t } = useLanguage();

  const { user } = useAuth();
  const [people, setPeople] = useState<User[] | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const handleSelect = async (person: User): Promise<void> => {
    if (multiSelect) {
      setSelectedIds((current) => {
        if (current.includes(person.id))
          return current.filter((id) => id !== person.id);
        if (current.length >= MAX_SHARE_RECIPIENTS) {
          toast.error(t('err.maxShare', { n: MAX_SHARE_RECIPIENTS }));
          return current;
        }
        return [...current, person.id];
      });
      return;
    }
    if (busyId) return;
    setBusyId(person.id);
    try {
      await onSelect(person);
    } catch {
      toast.error(t('err.openChat'));
      setBusyId(null);
    }
  };

  const handleSendMany = async (): Promise<void> => {
    if (!onSelectMany || !filtered || sending || !selectedIds.length) return;
    const chosen = filtered.filter((person) => selectedIds.includes(person.id));
    if (!chosen.length) return;
    setSending(true);
    try {
      await onSelectMany(chosen);
    } catch {
      toast.error(t('err.shareFail'));
      setSending(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const load = async (): Promise<void> => {
      const ids = Array.from(
        new Set([...(user.following ?? []), ...(user.followers ?? [])])
      ).filter((id) => id !== user.id);

      const docs = await Promise.all(
        ids.map((id) => getDoc(doc(usersCollection, id)))
      );
      setPeople(
        docs.flatMap((snapshot) => {
          const data = snapshot.data();
          return data ? [data] : [];
        })
      );
    };

    void load();
  }, [user]);

  const filtered = useMemo(() => {
    if (!people) return null;
    const visible = people.filter(
      (person) =>
        !user?.blockedUsers?.includes(person.id) &&
        !person.blockedUsers?.includes(user?.id ?? '')
    );
    const term = search.trim().toLowerCase();
    if (!term) return visible;
    return visible.filter(
      (person) =>
        person.name.toLowerCase().includes(term) ||
        person.username.toLowerCase().includes(term)
    );
  }, [people, search, user]);

  const selectedPeople =
    filtered?.filter((person) => selectedIds.includes(person.id)) ?? [];

  return (
    <div className='flex h-[70vh] max-h-[480px] flex-col'>
      <div className='flex items-center justify-between border-b border-light-border px-4 py-3 dark:border-dark-border'>
        <h2 className='text-lg font-bold'>{title ?? t('messages.new')}</h2>
        <button
          type='button'
          onClick={closeModal}
          aria-label={t('common.close')}
          className='custom-button dark-bg-tab p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
        >
          <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
        </button>
      </div>

      <div className='border-b border-light-border px-4 py-2 dark:border-dark-border'>
        <div className='flex items-center gap-2 rounded-full bg-main-search-background px-4 py-2'>
          <HeroIcon
            className='h-4 w-4 text-light-secondary dark:text-dark-secondary'
            iconName='MagnifyingGlassIcon'
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              multiSelect ? t('chat.searchMany') : t('chat.searchPerson')
            }
            className='w-full bg-transparent text-sm outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
          />
        </div>
        {multiSelect && selectedPeople.length > 0 && (
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {selectedPeople.map((person) => (
              <button
                key={person.id}
                type='button'
                onClick={() =>
                  setSelectedIds((current) =>
                    current.filter((id) => id !== person.id)
                  )
                }
                className='flex items-center gap-1 rounded-full bg-main-accent/15 px-2.5 py-1 text-xs font-bold text-main-accent-text'
              >
                {person.name}
                <HeroIcon className='h-3.5 w-3.5' iconName='XMarkIcon' />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className='flex-1 overflow-y-auto'>
        {!filtered ? (
          <Loading className='mt-8' />
        ) : filtered.length ? (
          filtered.map((person) => {
            const selected = selectedIds.includes(person.id);
            return (
              <button
                key={person.id}
                type='button'
                onClick={() => void handleSelect(person)}
                disabled={!!busyId || sending}
                className={cn(
                  `hover-animation flex w-full items-center gap-3 px-4 py-3 text-right
                   hover:bg-light-primary/5 disabled:opacity-60 dark:hover:bg-dark-primary/5`,
                  selected && 'bg-main-accent/10'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={person.photoURL || '/assets/default-avatar.png'}
                  alt={person.name}
                  className='h-10 w-10 shrink-0 rounded-full object-cover'
                />
                <div className='flex min-w-0 flex-col'>
                  <span className='flex items-center gap-1'>
                    <span className='truncate text-[15px] font-bold'>
                      {person.name}
                    </span>
                    {person.verified && <VerifiedBadge className='h-4 w-4' />}
                  </span>
                  <span className='truncate text-sm text-light-secondary dark:text-dark-secondary'>
                    @{person.username}
                  </span>
                </div>
                {multiSelect ? (
                  <span
                    className={cn(
                      'ms-auto flex h-5 w-5 items-center justify-center rounded-full border',
                      selected
                        ? 'border-main-accent bg-main-accent text-main-accent-contrast'
                        : 'border-light-border dark:border-dark-border'
                    )}
                  >
                    {selected && (
                      <HeroIcon className='h-3.5 w-3.5' iconName='CheckIcon' />
                    )}
                  </span>
                ) : (
                  busyId === person.id && <Loading className='ms-auto h-4 w-4' />
                )}
              </button>
            );
          })
        ) : (
          <p className='p-8 text-center text-light-secondary dark:text-dark-secondary'>
            {t('chat.noPeople')}
          </p>
        )}
      </div>

      {multiSelect && (
        <div className='border-t border-light-border p-3 dark:border-dark-border'>
          <Button
            className='w-full rounded-full bg-main-accent py-3 font-bold text-main-accent-contrast disabled:opacity-40'
            onClick={handleSendMany}
            loading={sending}
            disabled={!selectedIds.length}
          >
            {selectedIds.length > 1
              ? t('chat.sendMany', { n: selectedIds.length })
              : selectedIds.length === 1
              ? t('chat.sendOne')
              : t('chat.pickPeople')}
          </Button>
        </div>
      )}
    </div>
  );
}
