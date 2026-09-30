import { act, render, screen } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import Reels from '@pages/reels';
import type { Story } from '@lib/types/story';

jest.mock('@lib/firebase/collections', () => ({
  storiesCollection: { id: 'stories' }
}));

jest.mock('@lib/hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: jest.fn()
}));

jest.mock('@lib/firebase/users', () => ({
  loadUsersByIds: (): Promise<Map<string, never>> =>
    Promise.resolve(new Map<string, never>())
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    asPath: '/reels',
    pathname: '/reels',
    push: jest.fn(),
    replace: jest.fn(),
    isReady: true
  })
}));

jest.mock('@lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'me', following: [] }, loading: false })
}));

jest.mock('@lib/context/language-context', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    isRtl: true,
    language: 'ar'
  })
}));

jest.mock('@components/layout/common-layout', () => ({
  ProtectedLayout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  )
}));

jest.mock('@components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

jest.mock('@components/common/seo', () => ({
  SEO: () => null
}));

jest.mock('@components/reels/reel-card', () => ({
  ReelCard: ({ reel }: { reel: Story }) => (
    <div data-testid={`reel-${reel.id}`} />
  )
}));

jest.mock('@components/reels/create-reel-modal', () => ({
  CreateReelModal: () => null
}));

jest.mock('@components/ui/skeleton', () => ({
  ReelSkeleton: () => <div data-testid='reel-skeleton' />
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() }
}));

import { useInfiniteScroll } from '@lib/hooks/useInfiniteScroll';

type Source = {
  data: Story[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
  LoadMore: () => JSX.Element;
};

const mockedUseInfiniteScroll = useInfiniteScroll as unknown as jest.Mock<
  Source,
  [unknown, Constraint[]]
>;

const HOUR = 60 * 60 * 1000;
const NOW = Date.now();

function reel(id: string, ageHours = 2, kind: 'reel' | null = 'reel'): Story {
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
    createdAt: Timestamp.fromMillis(NOW - ageHours * HOUR),
    expiresAt: Timestamp.fromMillis(NOW + 29 * 24 * HOUR),
    updatedAt: null
  } as unknown as Story;
}

function plainStory(id: string): Story {
  return {
    id,
    userId: `owner-${id}`,
    kind: 'story',
    images: [
      {
        id: 'm',
        src: `https://cdn.test/${id}.jpg`,
        alt: '',
        type: 'image/jpeg'
      }
    ],
    caption: null,
    color: '#000000',
    likes: [],
    views: [],
    createdAt: Timestamp.fromMillis(NOW - HOUR),
    expiresAt: Timestamp.fromMillis(NOW + 12 * HOUR),
    updatedAt: null
  } as unknown as Story;
}

function source(data: Story[] | null): Source {
  return {
    data,
    loading: false,
    refresh: (): Promise<void> => Promise.resolve(),
    LoadMore: (): JSX.Element => <div data-testid='load-more' />
  };
}

type Constraint = {
  type?: string;
  _field?: { segments?: string[] };
  _op?: string;
  _value?: unknown;
};

/** استعلام الريلز الموسومة هو الوحيد الذي يحمل شرط kind == 'reel'. */
function isTaggedQuery(constraints: Constraint[]): boolean {
  return constraints.some(
    (constraint) =>
      constraint.type === 'where' &&
      constraint._field?.segments?.[0] === 'kind' &&
      constraint._op === '==' &&
      constraint._value === 'reel'
  );
}

/**
 * نربط كل استعلام بمصدره حسب قيوده لا حسب ترتيب النداء: الصفحة تُعاد
 * تصييرها أكثر من مرة (تحميل الملّاك، جاهزية الرابط العميق).
 */
function mockSources(tagged: Story[] | null, legacy: Story[] | null): void {
  mockedUseInfiniteScroll.mockImplementation(
    (_collection: unknown, constraints: Constraint[]) =>
      source(isTaggedQuery(constraints) ? tagged : legacy)
  );
}

describe('Reels page', () => {
  beforeEach(() => {
    mockedUseInfiniteScroll.mockReset();
  });

  it('renders every reel as its own full-height snap screen', () => {
    mockSources([reel('a', 1), reel('b', 3), reel('c', 5)], []);

    act(() => {
      render(<Reels />);
    });

    expect(screen.getByTestId('reel-a')).toBeInTheDocument();
    expect(screen.getByTestId('reel-b')).toBeInTheDocument();
    expect(screen.getByTestId('reel-c')).toBeInTheDocument();

    const scrollRoot = document.querySelector(
      '[data-scroll-root]'
    ) as HTMLElement;
    expect(scrollRoot).not.toBeNull();
    expect(scrollRoot.className).toContain('snap-y');
    expect(scrollRoot.className).toContain('snap-mandatory');
    expect(
      scrollRoot.querySelectorAll(':scope > div.snap-start.snap-always')
    ).toHaveLength(3);
  });

  it('keeps the paging sentinel out of the snap surface', () => {
    mockSources([reel('a')], []);

    act(() => {
      render(<Reels />);
    });

    const scrollRoot = document.querySelector(
      '[data-scroll-root]'
    ) as HTMLElement;
    expect(scrollRoot).not.toBeNull();
    expect(scrollRoot.dataset.preserveScroll).toBe('true');
    expect(scrollRoot.contains(screen.getByTestId('load-more'))).toBe(false);
  });

  it('still shows legacy untagged video reels next to the tagged ones', () => {
    // هذا ما كان يحدث فعلياً: أول 50 مستنداً من المجموعة كلها كانت قصصاً
    // عادية، فلا يصل إلى الشاشة إلا ريل واحد.
    const stories = Array.from({ length: 30 }, (_, index) =>
      plainStory(`s${index}`)
    );
    mockSources(
      [...stories, reel('tagged1')],
      [...stories, reel('legacy1', 4, null), reel('legacy2', 6, null)]
    );

    act(() => {
      render(<Reels />);
    });

    expect(screen.getByTestId('reel-tagged1')).toBeInTheDocument();
    expect(screen.getByTestId('reel-legacy1')).toBeInTheDocument();
    expect(screen.getByTestId('reel-legacy2')).toBeInTheDocument();
    expect(screen.queryByTestId('reel-s0')).toBeNull();
  });

  it('shows the empty state when there is nothing to watch', () => {
    mockSources([], []);

    act(() => {
      render(<Reels />);
    });

    expect(screen.getByText('reels.empty')).toBeInTheDocument();
  });
});
