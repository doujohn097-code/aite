import { Capacitor } from '@capacitor/core';
import type { AppUpdate, AppUpdateTarget } from './types/app-update';

const DISMISS_KEY = 'aite:dismissed-update';
const APPLIED_KEY = 'aite:applied-update';

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
  nativeInfo: NativeAppInfo | null
): boolean {
  if (!update?.active) return false;
  const native = !!nativeInfo || isNativeAndroid();
  if (!updateAppliesTo(update.target, native)) return false;
  if (native && nativeInfo && update.versionCode <= nativeInfo.versionCode)
    return false;
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

export function markUpdateApplied(id: string): void {
  try {
    window.localStorage.setItem(APPLIED_KEY, id);
  } catch {
    /* private mode */
  }
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
