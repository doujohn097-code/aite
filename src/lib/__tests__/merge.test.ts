import { mergeData } from '../merge';
import type { Timestamp } from 'firebase/firestore';

type Item = { id: string; createdAt: Timestamp };

function makeTimestamp(time: number): Timestamp {
  return {
    toDate: () => new Date(time),
    toMillis: () => time,
    seconds: Math.floor(time / 1000),
    nanoseconds: 0,
    isEqual: (other: Timestamp) => other.toMillis() === time,
    valueOf: () => time
  } as unknown as Timestamp;
}

function makeItem(id: string, time: number): Item {
  return { id, createdAt: makeTimestamp(time) };
}

describe('mergeData', () => {
  it('returns null when all inputs are null', () => {
    expect(mergeData(false, null, null)).toBeNull();
  });

  it('returns null when all inputs are empty arrays', () => {
    expect(mergeData(false, [], [])).toBeNull();
  });

  it('merges multiple arrays without sorting when sortData is false', () => {
    const a = [makeItem('1', 100), makeItem('2', 200)];
    const b = [makeItem('3', 50)];

    const result = mergeData(false, a, b);
    expect(result?.map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('merges and sorts by createdAt descending when sortData is true', () => {
    const a = [makeItem('1', 100)];
    const b = [makeItem('2', 300)];
    const c = [makeItem('3', 200)];

    const result = mergeData(true, a, b, c);
    expect(result?.map((item) => item.id)).toEqual(['2', '3', '1']);
  });

  it('ignores null entries mixed with valid arrays', () => {
    const a = [makeItem('1', 100)];
    const result = mergeData(false, a, null, [], undefined as never);
    expect(result?.map((item) => item.id)).toEqual(['1']);
  });

  it('preserves the original arrays (does not mutate input)', () => {
    const a = [makeItem('1', 100), makeItem('2', 50)];
    const original = a.map((item) => item.id);
    mergeData(true, a);
    expect(a.map((item) => item.id)).toEqual(original);
  });
});
