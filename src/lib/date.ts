import { intlLocale, translate } from '@lib/i18n';
import { getActiveLocale } from '@lib/i18n/locale-store';
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

export function formatClockTime(
  date: Date,
  locale?: ReturnType<typeof getActiveLocale>
): string {
  const active = locale ?? getActiveLocale();
  return new Intl.DateTimeFormat(intlLocale(active), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: active !== 'fr'
  }).format(date);
}

export function formatNumber(number: number): string {
  return new Intl.NumberFormat(intlLocale(getActiveLocale()), {
    notation: number > 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(number);
}

function loc(): ReturnType<typeof intlLocale> {
  return intlLocale(getActiveLocale());
}

function tDate(
  key:
    | 'date.justNow'
    | 'date.todayAt'
    | 'date.yesterdayAt'
    | 'date.min'
    | 'date.hour'
    | 'date.day',
  params?: Record<string, string | number>
): string {
  return translate(getActiveLocale(), key, params);
}

function getFullTime(date: Date): string {
  return new Intl.DateTimeFormat(loc(), {
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
    return new Intl.DateTimeFormat(loc(), {
      day: 'numeric',
      month: 'short'
    }).format(date);

  return new Intl.DateTimeFormat(loc(), {
    day: 'numeric',
    month: 'short',
    year: isCurrentYear(date) ? undefined : 'numeric'
  }).format(date);
}

function getJoinedTime(date: Date): string {
  return new Intl.DateTimeFormat(loc(), {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function getShortTime(date: Date): string {
  const time = formatClockTime(date);

  if (isToday(date)) return tDate('date.todayAt', { time });
  if (isYesterday(date)) return tDate('date.yesterdayAt', { time });
  return getFullTime(date);
}

function getRelativeTime(date: Date): string {
  const elapsed = +new Date() - +date;

  if (elapsed < 60_000) return tDate('date.justNow');

  const unitsItems = Object.entries(UNITS) as [keyof Units, number][];

  for (const [unit, millis] of unitsItems)
    if (elapsed >= millis) {
      const value = Math.round(elapsed / millis);
      if (unit === 'day') return tDate('date.day', { n: value });
      if (unit === 'hour') return tDate('date.hour', { n: value });
      return tDate('date.min', { n: value });
    }

  return tDate('date.justNow');
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
