import { useCallback } from 'react';
import { useRouter } from 'next/router';
import { runPageRefresh } from '@lib/refresh-bus';
import { PullToRefresh } from './pull-to-refresh';

const BLOCKED = new Set(['/', '/accounts', '/admin']);

export function GlobalPullToRefresh(): JSX.Element | null {
  const router = useRouter();
  const path = router.pathname;
  const disabled =
    BLOCKED.has(path) ||
    path.startsWith('/accounts') ||
    path.startsWith('/admin');

  const handleRefresh = useCallback(async (): Promise<void> => {
    await runPageRefresh();
  }, []);

  if (disabled) return null;

  return <PullToRefresh overlay onRefresh={handleRefresh} />;
}
