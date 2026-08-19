import type { Timestamp } from 'firebase/firestore';

type Units = Readonly<Partial<Record<Intl.RelativeTimeFormatUnit, number>>>;

const UNITS: Units = {
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000
};

export function getTimestampMillis(t: unknown): number {
  if (!t) return 0;
  if (typeof (t as { toMillis?: () => number }).toMillis === 'function') {
    return (t as { toMillis: () => number }).toMillis();
  }
  if (typeof (t as { seconds?: number }).seconds === 'number') {
    const s = (t as { seconds: number; nanoseconds?: number }).seconds;
    const ns = (t as { nanoseconds?: number }).nanoseconds ?? 0;
    return s * 1000 + Math.round(ns / 1_000_000);
  }
  if (typeof (t as { toDate?: () => Date }).toDate === 'function') {
    return (t as { toDate: () => Date }).toDate().getTime();
  }
  if (t instanceof Date) return t.getTime();
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const ms = new Date(t).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  return 0;
}

export function formatDate(
  targetDate: Timestamp,
  mode: 'tweet' | 'message' | 'full' | 'joined'
): string {
  const date = targetDate.toDate();

  if (mode === 'full') return getFullTime(date);
  if (mode === 'tweet') return getPostTime(date);
  if (mode === 'joined') return getJoinedTime(date);

  return getShortTime(date);
}

export function formatNumber(number: number): string {
  return new Intl.NumberFormat('ar', {
    notation: number > 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(number);
}

function getFullTime(date: Date): string {
  return new Intl.DateTimeFormat('ar', {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function getPostTime(date: Date): string {
  if (isToday(date)) return getRelativeTime(date);
  if (isYesterday(date))
    return new Intl.DateTimeFormat('ar', {
      day: 'numeric',
      month: 'short'
    }).format(date);

  return new Intl.DateTimeFormat('ar', {
    day: 'numeric',
    month: 'short',
    year: isCurrentYear(date) ? undefined : 'numeric'
  }).format(date);
}

function getJoinedTime(date: Date): string {
  return new Intl.DateTimeFormat('ar', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function getShortTime(date: Date): string {
  const isNear = isToday(date) ? 'today' : isYesterday(date) ? 'yesterday' : null;

  const time = new Intl.DateTimeFormat('ar', {
    hour: 'numeric',
    minute: 'numeric'
  }).format(date);

  return isNear
    ? `${isNear === 'today' ? 'اليوم' : 'أمس'} في ${time}`
    : getFullTime(date);
}

function getRelativeTime(date: Date): string {
  const elapsed = +new Date() - +date;

  if (elapsed < 60_000) return 'الآن';

  const unitsItems = Object.entries(UNITS) as [keyof Units, number][];

  for (const [unit, millis] of unitsItems)
    if (elapsed >= millis) {
      const value = Math.round(elapsed / millis);
      const suffix =
        unit === 'day' ? 'ي' : unit === 'hour' ? 'س' : 'د';
      return `${value}${suffix}`;
    }

  return 'الآن';
}

function isToday(date: Date): boolean {
  return new Date().toDateString() === date.toDateString();
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toDateString() === date.toDateString();
}

function isCurrentYear(date: Date): boolean {
  return date.getFullYear() === new Date().getFullYear();
}
