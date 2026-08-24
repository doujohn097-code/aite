import { Capacitor } from '@capacitor/core';
import { APP_VERSION_CODE, APP_VERSION_NAME } from './app-version';
import type { AppUpdate, AppUpdateTarget } from './types/app-update';

const DISMISS_KEY = 'aite:dismissed-update';
const APPLIED_KEY = 'aite:applied-update';
const APPLIED_CODE_KEY = 'aite:applied-version-code';

export type NativeAppInfo = {
  versionCode: number;
  versionName: string;
};

type AndroidBridge = {
  versionCode?: number;
  versionName?: string;
  getVersionCode?: () => number | string;
  getVersionName?: () => string;
  installUpdate?: (url: string) => void;
};

function androidBridge(): AndroidBridge | null {
  if (typeof window === 'undefined') return null;
  return (
    (window as Window & { AiteAndroid?: AndroidBridge }).AiteAndroid ?? null
  );
}

export function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.getPlatform() === 'android' || !!androidBridge();
}

export function getNativeAppInfo(): NativeAppInfo | null {
  const bridge = androidBridge();
  if (!bridge) return null;
  const rawCode = bridge.getVersionCode?.() ?? bridge.versionCode;
  const code = Number(rawCode);
  const name = String(bridge.getVersionName?.() ?? bridge.versionName ?? '');
  if (!Number.isFinite(code) || code <= 0) return null;
  return { versionCode: code, versionName: name || String(code) };
}

export function getInstalledAppInfo(): NativeAppInfo {
  return (
    getNativeAppInfo() ?? {
      versionCode: APP_VERSION_CODE,
      versionName: APP_VERSION_NAME
    }
  );
}

export function canInstallNativeUpdate(): boolean {
  return typeof androidBridge()?.installUpdate === 'function';
}

export function installNativeUpdate(apkUrl: string): boolean {
  const installer = androidBridge()?.installUpdate;
  if (!installer) return false;
  installer(apkUrl);
  return true;
}

export function updateAppliesTo(
  target: AppUpdateTarget,
  native: boolean
): boolean {
  if (target === 'all') return true;
  if (target === 'android') return native;
  return !native;
}

export function shouldOfferUpdate(
  update: AppUpdate | null,
  nativeInfo: NativeAppInfo | null,
  options?: { waitForNative?: boolean }
): boolean {
  if (!update?.active) return false;
  if (options?.waitForNative) return false;
  const native = !!nativeInfo || isNativeAndroid();
  if (!updateAppliesTo(update.target, native)) return false;
  const installedCode = nativeInfo?.versionCode ?? APP_VERSION_CODE;
  if (update.versionCode <= installedCode) return false;
  if (readAppliedVersionCode() >= update.versionCode) return false;
  if (readAppliedId() === update.id) return false;
  if (!update.force && readDismissedId() === update.id) return false;
  return true;
}

export function readDismissedId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

export function dismissUpdate(id: string): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, id);
  } catch {
    /* private mode */
  }
}

export function readAppliedId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(APPLIED_KEY);
  } catch {
    return null;
  }
}

export function markUpdateApplied(id: string, versionCode?: number): void {
  try {
    window.localStorage.setItem(APPLIED_KEY, id);
    if (typeof versionCode === 'number' && versionCode > 0)
      window.localStorage.setItem(APPLIED_CODE_KEY, String(versionCode));
  } catch {
    /* private mode */
  }
}

export function readAppliedVersionCode(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = Number(window.localStorage.getItem(APPLIED_CODE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

export type UpdateProgressStatus =
  | 'starting'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'error';

export type UpdateProgressDetail = {
  percent: number;
  status: UpdateProgressStatus;
  message?: string;
};

export function parseUpdateProgress(
  value: unknown
): UpdateProgressDetail | null {
  if (!value || typeof value !== 'object') return null;
  const detail = value as Partial<UpdateProgressDetail>;
  const status = detail.status;
  if (
    status !== 'starting' &&
    status !== 'downloading' &&
    status !== 'installing' &&
    status !== 'done' &&
    status !== 'error'
  )
    return null;
  const percent = Number(detail.percent);
  return {
    status,
    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
    message: typeof detail.message === 'string' ? detail.message : undefined
  };
}

export function isSafeApkUrl(value: string): boolean {
  if (!value || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.')
    )
      return false;
    return (
      /\.apk(\?|#|$)/i.test(url.pathname + url.search) ||
      url.href.includes('.apk')
    );
  } catch {
    return false;
  }
}
