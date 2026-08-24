import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  canInstallNativeUpdate,
  dismissUpdate,
  getNativeAppInfo,
  installNativeUpdate,
  isNativeAndroid,
  markUpdateApplied,
  shouldOfferUpdate
} from '@lib/app-update';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type { AppUpdate } from '@lib/types/app-update';

async function fetchPublishedUpdate(): Promise<AppUpdate | null> {
  const response = await fetch('/api/update', { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json()) as { update?: AppUpdate | null };
  return data.update ?? null;
}

export function AppUpdatePrompt(): JSX.Element | null {
  const router = useRouter();
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const native = isNativeAndroid();
  const nativeInfo = getNativeAppInfo();
  const visible =
    !hidden &&
    router.pathname !== '/admin' &&
    shouldOfferUpdate(update, nativeInfo);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setUpdate(await fetchPublishedUpdate());
    } catch {
      /* keep last known value */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  if (!visible || !update) return null;

  const hasApk = !!update.apkUrl;
  const canNativeInstall = native && hasApk && canInstallNativeUpdate();

  const handleUpdate = (): void => {
    if (canNativeInstall && update.apkUrl) {
      setBusy(true);
      const started = installNativeUpdate(update.apkUrl);
      if (!started) window.open(update.apkUrl, '_blank');
      window.setTimeout(() => setBusy(false), 1200);
      return;
    }
    if (hasApk && update.apkUrl && native) {
      window.location.assign(update.apkUrl);
      return;
    }
    markUpdateApplied(update.id);
    window.location.reload();
  };

  return (
    <div className='fixed inset-0 z-[180] flex items-end justify-center bg-black/55 p-4 xs:items-center'>
      <div className='w-full max-w-md overflow-hidden rounded-3xl border border-light-border bg-main-background shadow-2xl dark:border-dark-border'>
        <div className='flex items-start gap-3 px-5 pt-5'>
          <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-main-accent/15 text-main-accent-text'>
            <HeroIcon className='h-6 w-6' iconName='ArrowDownTrayIcon' />
          </span>
          <div className='min-w-0'>
            <p className='text-lg font-black'>{update.title || 'تحديث جديد'}</p>
            <p className='mt-1 text-xs font-bold text-main-accent-text'>
              الإصدار {update.versionName}
              {nativeInfo ? ` · المثبت ${nativeInfo.versionName}` : ''}
            </p>
          </div>
        </div>
        {update.message && (
          <p className='whitespace-pre-line px-5 pt-3 text-sm leading-relaxed text-light-secondary dark:text-dark-secondary'>
            {update.message}
          </p>
        )}
        <div className='flex flex-col gap-2 p-5'>
          <Button
            className='w-full rounded-full bg-main-accent py-3 font-bold text-main-accent-contrast'
            loading={busy}
            onClick={handleUpdate}
          >
            {native && hasApk ? 'تثبيت التحديث' : 'تحديث الآن'}
          </Button>
          {hasApk && !native && (
            <a
              href={update.apkUrl ?? undefined}
              className='flex w-full items-center justify-center rounded-full border border-light-border py-3 text-sm font-bold dark:border-dark-border'
            >
              تحميل تطبيق أندرويد
            </a>
          )}
          {!update.force && (
            <Button
              className='w-full py-2 text-sm text-light-secondary dark:text-dark-secondary'
              onClick={(): void => {
                dismissUpdate(update.id);
                setHidden(true);
              }}
            >
              لاحقاً
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
