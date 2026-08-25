import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import {
  clearImpersonation,
  readImpersonation,
  type ImpersonationSession
} from '@lib/impersonation';
import { Button } from '@components/ui/button';

export function ImpersonationBanner(): JSX.Element | null {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const current = readImpersonation();
    setSession(current && user && current.userId === user.id ? current : null);
  }, [user?.id]);

  if (!session || !user) return null;

  const leave = async (): Promise<void> => {
    if (leaving) return;
    setLeaving(true);
    clearImpersonation();
    await signOut();
    void router.replace('/admin');
  };

  return (
    <div className='sticky top-0 z-[80] flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-sm font-bold text-black'>
      <p className='min-w-0 truncate'>
        أنت داخل حساب {session.name} @{session.username} كمدير
      </p>
      <Button
        className='shrink-0 rounded-full bg-black px-3 py-1 text-xs font-bold text-white'
        loading={leaving}
        onClick={(): void => {
          void leave();
        }}
      >
        إنهاء والعودة
      </Button>
    </div>
  );
}
