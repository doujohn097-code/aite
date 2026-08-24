import { useEffect } from 'react';
import { registerPageRefresh } from '@lib/refresh-bus';

export function usePageRefresh(
  handler: () => void | Promise<void>
): void {
  useEffect(() => registerPageRefresh(handler), [handler]);
}
