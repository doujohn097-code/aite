import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { usersCollection } from '@lib/firebase/collections';
import { useAuth } from '@lib/context/auth-context';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { VerifiedBadge } from '@components/ui/verified-badge';
import type { User } from '@lib/types/user';

type NewMessageModalProps = {
  closeModal: () => void;
  onSelect: (user: User) => void | Promise<void>;
};

export function NewMessageModal({
  closeModal,
  onSelect
}: NewMessageModalProps): JSX.Element {
  const { user } = useAuth();
  const [people, setPeople] = useState<User[] | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSelect = async (person: User): Promise<void> => {
    if (busyId) return;
    setBusyId(person.id);
    try {
      await onSelect(person);
    } catch {
      toast.error('تعذر فتح المحادثة، حاول مرة أخرى');
      setBusyId(null);
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
  }, [people, search]);

  return (
    <div className='flex h-[70vh] max-h-[480px] flex-col'>
      <div className='flex items-center justify-between border-b border-light-border px-4 py-3 dark:border-dark-border'>
        <h2 className='text-lg font-bold'>رسالة جديدة</h2>
        <button
          type='button'
          onClick={closeModal}
          aria-label='إغلاق'
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
            placeholder='ابحث عن شخص'
            className='w-full bg-transparent text-sm outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
          />
        </div>
      </div>

      <div className='flex-1 overflow-y-auto'>
        {!filtered ? (
          <Loading className='mt-8' />
        ) : filtered.length ? (
          filtered.map((person) => (
            <button
              key={person.id}
              type='button'
              onClick={() => void handleSelect(person)}
              disabled={!!busyId}
              className='hover-animation flex w-full items-center gap-3 px-4 py-3 text-right
                         hover:bg-light-primary/5 disabled:opacity-60
                         dark:hover:bg-dark-primary/5'
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
              {busyId === person.id && <Loading className='ms-auto h-4 w-4' />}
            </button>
          ))
        ) : (
          <p className='p-8 text-center text-light-secondary dark:text-dark-secondary'>
            لا يوجد أشخاص مطابقون
          </p>
        )}
      </div>
    </div>
  );
}
