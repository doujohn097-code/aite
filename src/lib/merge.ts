import type { Timestamp } from 'firebase/firestore';

type DataWithDate<T> = T & { createdAt: Timestamp };

function millis(value: unknown): number {
  if (!value) return 0;
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function')
    return (value as { toMillis: () => number }).toMillis();
  const ts = value as { seconds?: number; nanoseconds?: number };
  if (typeof ts.seconds === 'number')
    return ts.seconds * 1000 + Math.round((ts.nanoseconds ?? 0) / 1_000_000);
  return 0;
}

export function mergeData<T>(
  sortData: boolean,
  ...tweets: (DataWithDate<T>[] | null)[]
): DataWithDate<T>[] | null {
  const validData = tweets.filter((tweet) => tweet) as DataWithDate<T>[][];
  const mergeData = validData.reduce((acc, tweet) => [...acc, ...tweet], []);

  return mergeData.length
    ? sortData
      ? mergeData.sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
      : mergeData
    : null;
}
