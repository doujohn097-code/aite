import { renderHook, act } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { useReelsFeed } from '../useReelsFeed';
import type { Story } from '../../types/story';

jest.mock('@lib/firebase/collections', () => ({
  storiesCollection: { id: 'stories' }
}));

jest.mock('../useInfiniteScroll', () => ({
  useInfiniteScroll: jest.fn()
}));

import { useInfiniteScroll } from '../useInfiniteScroll';

type Source = {
  data: Story[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
  LoadMore: () => JSX.Element;
  hasMore: boolean;
  expand: () => Promise<void>;
};

type Constraint = {
  type?: string;
  _field?: { segments?: string[] };
  _op?: string;
  _value?: unknown;
  _direction?: string;
};

type InfiniteScrollMock = jest.Mock<
  Source,
  [
    unknown,
    Constraint[],
    { allowNull: boolean },
    { initialSize: number; stepSize: number }
  ]
>;

const mockedUseInfiniteScroll =
  useInfiniteScroll as unknown as InfiniteScrollMock;

const HOUR = 60 * 60 * 1000;
const NOW = Date.now();
const refreshed: string[] = [];

/** نافذة الريلز الموسومة هي الوحيدة التي تحمل قيوداً. */
function isTagged(constraints: Constraint[]): boolean {
  return constraints.length > 0;
}

function fixture(
  id: string,
  kind: 'reel' | 'story' | null,
  overrides: Partial<Story> = {}
): Story {
  return {
    id,
    userId: `owner-${id}`,
    kind,
    images: [
      {
        id: 'm',
        src: `https://cdn.test/${id}.mp4`,
        alt: '',
        type: 'video/mp4'
      }
    ],
    caption: null,
    color: '#000000',
    likes: [],
    views: [],
    createdAt: Timestamp.fromMillis(NOW - 2 * HOUR),
    expiresAt: Timestamp.fromMillis(NOW + 29 * 24 * HOUR),
    updatedAt: null,
    ...overrides
  } as unknown as Story;
}

function storyOnly(id: string): Story {
  return fixture(id, 'story', {
    images: [
      {
        id: 'm',
        src: `https://cdn.test/${id}.jpg`,
        alt: '',
        type: 'image/jpeg'
      }
    ],
    expiresAt: Timestamp.fromMillis(NOW + 12 * HOUR)
  });
}

const expanded: string[] = [];

function source(
  id: string,
  data: Story[] | null,
  options: { loading?: boolean; hasMore?: boolean } = {}
): Source {
  const { loading = false, hasMore = false } = options;
  return {
    data,
    loading,
    hasMore,
    refresh: (): Promise<void> => {
      refreshed.push(id);
      return Promise.resolve();
    },
    expand: (): Promise<void> => {
      expanded.push(id);
      return Promise.resolve();
    },
    LoadMore: (): JSX.Element => <div data-testid='load-more' />
  };
}

describe('useReelsFeed', () => {
  beforeEach(() => {
    mockedUseInfiniteScroll.mockReset();
    refreshed.length = 0;
    expanded.length = 0;
  });

  it('opens a tagged window with paging plus an unfiltered fallback window', () => {
    mockedUseInfiniteScroll.mockImplementation((_collection, constraints) =>
      source(isTagged(constraints) ? 'tagged' : 'legacy', [])
    );

    renderHook(() => useReelsFeed());

    expect(mockedUseInfiniteScroll).toHaveBeenCalledTimes(2);
    const calls = mockedUseInfiniteScroll.mock.calls;
    const tagged = calls[0];
    const legacy = calls[1];

    expect(tagged[1]).toHaveLength(2);
    expect(tagged[1][0]).toMatchObject({
      type: 'where',
      _op: '==',
      _value: 'reel'
    });
    expect(tagged[1][0]._field?.segments).toEqual(['kind']);
    expect(tagged[1][1]).toMatchObject({
      type: 'orderBy',
      _direction: 'desc'
    });
    expect(tagged[1][1]._field?.segments).toEqual(['createdAt']);
    expect(tagged[2]).toEqual({ allowNull: true });
    expect(tagged[3]).toEqual({ initialSize: 100, stepSize: 50 });
    expect(legacy[1]).toEqual([]);
    expect(legacy[3]).toEqual({ initialSize: 100, stepSize: 100 });
  });

  it('shows every reel even when the collection is full of 24h stories', () => {
    const tagged = [
      fixture('r1', 'reel'),
      fixture('r2', 'reel'),
      fixture('r3', 'reel')
    ];
    const legacy = [
      ...Array.from({ length: 40 }, (_, index) => storyOnly(`s${index}`)),
      fixture('legacy1', null),
      fixture('r1', 'reel')
    ];

    mockedUseInfiniteScroll.mockImplementation((_collection, constraints) =>
      source(
        isTagged(constraints) ? 'tagged' : 'legacy',
        isTagged(constraints) ? tagged : legacy
      )
    );

    const { result } = renderHook(() => useReelsFeed());

    expect(result.current.reels.map((reel) => reel.id).sort()).toEqual([
      'legacy1',
      'r1',
      'r2',
      'r3'
    ]);
  });

  it('drops expired reels and keeps the newest first', () => {
    const tagged = [
      fixture('old', 'reel', {
        createdAt: Timestamp.fromMillis(NOW - 5 * HOUR)
      }),
      fixture('dead', 'reel', {
        expiresAt: Timestamp.fromMillis(NOW - HOUR)
      }),
      fixture('new', 'reel', { createdAt: Timestamp.fromMillis(NOW - HOUR) })
    ];

    mockedUseInfiniteScroll.mockImplementation((_collection, constraints) =>
      source('tagged', isTagged(constraints) ? tagged : [])
    );

    const { result } = renderHook(() => useReelsFeed());

    expect(result.current.reels.map((reel) => reel.id)).toEqual(['new', 'old']);
  });

  it('stays in the loading state only while both sources are loading', () => {
    mockedUseInfiniteScroll.mockImplementation((_collection, constraints) =>
      isTagged(constraints)
        ? source('tagged', null, { loading: true })
        : source('legacy', [])
    );

    const { result } = renderHook(() => useReelsFeed());

    expect(result.current.loading).toBe(false);
  });

  it('widens the fallback window while the feed holds fewer than three reels', () => {
    mockedUseInfiniteScroll.mockImplementation((_collection, constraints) =>
      isTagged(constraints)
        ? source('tagged', [fixture('r1', 'reel')])
        : source('legacy', [], { hasMore: true })
    );

    renderHook(() => useReelsFeed());

    expect(expanded).toEqual(['legacy']);
  });

  it('stops widening once the feed has enough reels', () => {
    mockedUseInfiniteScroll.mockImplementation((_collection, constraints) =>
      isTagged(constraints)
        ? source('tagged', [
            fixture('r1', 'reel'),
            fixture('r2', 'reel'),
            fixture('r3', 'reel')
          ])
        : source('legacy', [], { hasMore: true })
    );

    renderHook(() => useReelsFeed());

    expect(expanded).toEqual([]);
  });

  it('refreshes both sources', () => {
    mockedUseInfiniteScroll.mockImplementation((_collection, constraints) =>
      source(isTagged(constraints) ? 'tagged' : 'legacy', [])
    );

    const { result } = renderHook(() => useReelsFeed());

    return act(() => result.current.refresh()).then(() => {
      expect(refreshed).toEqual(['tagged', 'legacy']);
    });
  });
});
