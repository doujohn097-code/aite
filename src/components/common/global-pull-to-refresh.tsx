import { useCallback } from 'react';
import { useRouter } from 'next/router';
import { runPageRefresh } from '@lib/refresh-bus';
import { isAdminPath } from '@lib/admin-path';
import { PullToRefresh } from './pull-to-refresh';

const BLOCKED = new Set(['/', '/accounts']);

export function GlobalPullToRefresh(): JSX.Element | null {
  const router = useRouter();
  const path = router.pathname;
  const disabled =
    BLOCKED.has(path) || path.startsWith('/accounts') || isAdminPath(path);

  const handleRefresh = useCallback(async (): Promise<void> => {
    await runPageRefresh();
  }, []);

  if (disabled) return null;

  return <PullToRefresh overlay onRefresh={handleRefresh} />;
}
