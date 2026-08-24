import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  canInstallNativeUpdate,
  dismissUpdate,
  getNativeAppInfo,
  installNativeUpdate,
  isNativeAndroid,
  markUpdateApplied,
  parseUpdateProgress,
  shouldOfferUpdate
} from '@lib/app-update';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import type { AppUpdate } from '@lib/types/app-update';
import type { UpdateProgressDetail } from '@lib/app-update';

type Phase = 'idle' | 'busy';

async function fetchPublishedUpdate(): Promise<AppUpdate | null> {
  const response = await fetch('/api/update', { cache: 'no-store' });
  if (!response.ok) return null;
  const data = (await response.json()) as { update?: AppUpdate | null };
  return data.update ?? null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} ب`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

async function downloadApkPreview(
  url: string,
  onProgress: (detail: UpdateProgressDetail & { received?: number; total?: number }) => void
): Promise<Blob> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('تعذر بدء التنزيل');
  const total = Number(response.headers.get('content-length') ?? 0);
  if (!response.body) return response.blob();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      const percent = total > 0 ? Math.round((received / total) * 100) : 0;
      onProgress({
        status: 'downloading',
        percent,
        received,
        total,
        message:
          total > 0
            ? `${formatBytes(received)} من ${formatBytes(total)}`
            : `تم تنزيل ${formatBytes(received)}`
      });
    }
  }

  const blob = new Blob(chunks, {
    type: 'application/vnd.android.package-archive'
  });
  onProgress({
    status: 'downloading',
    percent: 100,
    received,
    total: total || received,
    message: 'اكتمل التنزيل'
  });
  return blob;
}

function saveBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

export function AppUpdatePrompt(): JSX.Element | null {
  const router = useRouter();
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [nativeInfo, setNativeInfo] = useState(() => getNativeAppInfo());
  const [waitForNative, setWaitForNative] = useState(() =>
    isNativeAndroid() ? !getNativeAppInfo() : false
  );
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<UpdateProgressDetail | null>(null);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const native = isNativeAndroid();
  const downloading = phase === 'busy';
  const visible =
    !hidden &&
    router.pathname !== '/admin' &&
    shouldOfferUpdate(update, nativeInfo, { waitForNative });

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setNativeInfo(getNativeAppInfo());
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

  useEffect(() => {
    if (!waitForNative) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const info = getNativeAppInfo();
      if (info) {
        setNativeInfo(info);
        setWaitForNative(false);
        window.clearInterval(timer);
        return;
      }
      if (Date.now() - started > 2500) {
        setWaitForNative(false);
        window.clearInterval(timer);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [waitForNative]);

  useEffect(() => {
    const onProgress = (event: Event): void => {
      const detail = parseUpdateProgress((event as CustomEvent).detail);
      if (!detail) return;
      setProgress(detail);
      if (detail.message) setProgressLabel(detail.message);
      if (detail.status === 'error') {
        setPhase('idle');
        setError(detail.message || 'تعذر تنزيل التحديث');
      } else if (detail.status === 'done') {
        setProgressLabel('اكتمل التنزيل، أكمل التثبيت من النافذة التالية');
      } else {
        setPhase('busy');
      }
    };
    window.addEventListener('aite:update-progress', onProgress);
    return () => window.removeEventListener('aite:update-progress', onProgress);
  }, []);

  if (!visible || !update) return null;

  const hasApk = !!update.apkUrl;
  const canNativeInstall = native && hasApk && canInstallNativeUpdate();
  const percent = progress?.percent ?? 0;
  const indeterminate =
    downloading && (!progress || progress.status === 'starting' || percent <= 0);

  const handleUpdate = async (): Promise<void> => {
    setError(null);
    setPhase('busy');
    setProgress({ status: 'starting', percent: 1 });
    setProgressLabel(
      native && hasApk ? 'جارٍ تجهيز التنزيل…' : 'جارٍ تطبيق التحديث…'
    );

    if (canNativeInstall && update.apkUrl) {
      const started = installNativeUpdate(update.apkUrl);
      if (started) {
        setProgressLabel('جارٍ تنزيل التحديث… لا تغلق التطبيق');
        return;
      }
    }

    if (hasApk && update.apkUrl) {
      try {
        const blob = await downloadApkPreview(update.apkUrl, (detail) => {
          setProgress(detail);
          if (detail.message) setProgressLabel(detail.message);
        });
        saveBlob(blob, `Aite-${update.versionName || 'update'}.apk`);
        setProgress({ status: 'done', percent: 100 });
        setProgressLabel('تم حفظ الملف. افتحه لتثبيت التحديث ولا تغلق هذه النافذة.');
        setPhase('busy');
        return;
      } catch {
        setProgressLabel('تعذر العرض المباشر، سيتم فتح رابط التنزيل');
        window.location.assign(update.apkUrl);
        return;
      }
    }

    markUpdateApplied(update.id, update.versionCode);
    window.location.reload();
  };

  return (
    <div className='fixed inset-0 z-[180] flex items-end justify-center bg-black/70 p-4 xs:items-center'>
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
        {update.message && !downloading && (
          <p className='whitespace-pre-line px-5 pt-3 text-sm leading-relaxed text-light-secondary dark:text-dark-secondary'>
            {update.message}
          </p>
        )}
        {downloading && (
          <div className='px-5 pt-4'>
            <div className='flex items-center justify-between text-xs font-bold text-main-accent-text'>
              <span>{progressLabel || 'جارٍ التنزيل…'}</span>
              <span>{indeterminate ? '…' : `${percent}%`}</span>
            </div>
            <div className='mt-2 h-2.5 overflow-hidden rounded-full bg-light-line-reply dark:bg-dark-line-reply'>
              <div
                className={
                  indeterminate
                    ? 'h-full w-1/3 animate-pulse rounded-full bg-main-accent'
                    : 'h-full rounded-full bg-main-accent transition-[width] duration-200'
                }
                style={indeterminate ? undefined : { width: `${percent}%` }}
              />
            </div>
            <p className='mt-2 text-xs leading-relaxed text-light-secondary dark:text-dark-secondary'>
              ابقَ في هذه الشاشة حتى يكتمل التنزيل. لا تضغط رجوع ولا تغلق
              التطبيق.
            </p>
          </div>
        )}
        {error && (
          <p className='px-5 pt-3 text-sm text-accent-red'>{error}</p>
        )}
        <div className='flex flex-col gap-2 p-5'>
          <Button
            className='w-full rounded-full bg-main-accent py-3 font-bold text-main-accent-contrast'
            loading={downloading && !progress}
            disabled={downloading}
            onClick={(): void => {
              void handleUpdate();
            }}
          >
            {downloading
              ? progress?.status === 'done'
                ? 'أكمل التثبيت'
                : 'جارٍ التنزيل…'
              : native && hasApk
              ? 'تثبيت التحديث'
              : 'تحديث الآن'}
          </Button>
          {hasApk && !native && !downloading && (
            <a
              href={update.apkUrl ?? undefined}
              className='flex w-full items-center justify-center rounded-full border border-light-border py-3 text-sm font-bold dark:border-dark-border'
            >
              تحميل تطبيق أندرويد
            </a>
          )}
          {!update.force && !downloading && (
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
