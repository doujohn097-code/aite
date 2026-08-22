import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFirebase, getActiveProject } from '@lib/firebase/app';
import { collectionsFor } from '@lib/firebase/collections';
import { otherProject } from '@lib/project-types';
import type { ProjectId } from '@lib/project-types';
import type { User } from '@lib/types/user';
import type {
  Query,
  DocumentReference,
  DocumentData,
  CollectionReference
} from 'firebase/firestore';

/** Items returned by merged dual queries carry their home project. */
export type WithProject<T> = T & { project: ProjectId };

/**
 * The server proxy serializes Firestore Timestamps as { seconds, nanoseconds }
 * plain objects. Converting them back into real Timestamp instances at the
 * proxy boundary keeps every downstream `.toDate()` / `.toMillis()` call
 * working exactly like SDK-fetched data.
 */
function hydrateValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(hydrateValue);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (
      typeof record.seconds === 'number' &&
      typeof record.nanoseconds === 'number' &&
      Object.keys(record).length === 2
    ) {
      try {
        return new Timestamp(record.seconds, record.nanoseconds);
      } catch {
        return value;
      }
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record)) out[key] = hydrateValue(record[key]);
    return out;
  }
  return value;
}

function hydrateProxyItems(items: ProxyItem[] | null): ProxyItem[] | null {
  if (!items) return null;
  return items.map((item) => ({
    id: item.id,
    data: hydrateValue(item.data) as Record<string, unknown>
  }));
}

/**
 * Bounded wait: never let a blocked/slow database hang the UI. Falls back to
 * `fallback` after `ms` milliseconds.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Server-side read proxy (bypasses blocked WebChannel transports)
// ---------------------------------------------------------------------------

export type ProxyWhere = {
  field: string;
  op: '==' | 'in' | 'array-contains' | 'isNull' | '>=' | '<=' | '>' | '<';
  value?:
    | string
    | number
    | boolean
    | null
    | (string | number | boolean | null)[];
};

export type ProxySpec = {
  collection: 'tweets' | 'stories' | 'users' | 'conversations';
  where?: ProxyWhere | null;
  orderBy?: { field: string; dir: 'asc' | 'desc' } | null;
  limit?: number;
  ids?: string[];
};

export type ProxyItem = { id: string; data: Record<string, unknown> };

const proxyCache = new Map<string, Promise<ProxyItem[] | null>>();

/** Runs a whitelisted read through OUR server (admin SDK) — immune to
 * client-side blockers that kill the Firestore WebChannel. */
export function queryViaProxy(
  project: ProjectId,
  spec: ProxySpec
): Promise<ProxyItem[] | null> {
  const key = `${project}:${JSON.stringify(spec)}`;
  const cached = proxyCache.get(key);
  if (cached) return cached;
  const task = (async (): Promise<ProxyItem[] | null> => {
    try {
      const currentUser = getFirebase(getActiveProject()).auth.currentUser;
      if (!currentUser) return null;
      const idToken = await withTimeout(currentUser.getIdToken(), 8000, null);
      if (!idToken) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({ project, q: spec }),
          signal: controller.signal
        });
        if (!response.ok) return null;
        const data = (await response.json()) as { items?: ProxyItem[] };
        return hydrateProxyItems(data.items ?? null);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return null;
    }
  })();
  proxyCache.set(key, task);
  return task;
}

// ---------------------------------------------------------------------------
// Project health (degraded mode)
//
// Only genuine network/channel failures count towards skipping a project;
// permission errors are usually transient (peer sign-in timing) and never
// skip. A skipped project still gets server-side proxy reads.
// ---------------------------------------------------------------------------

const FAILURES_TO_SKIP = 3;
const SKIP_TTL_MS = 5 * 60 * 1000;

const projectFailures: Record<ProjectId, number> = { a: 0, b: 0 };
const projectSkippedAt: Partial<Record<ProjectId, number>> = {};

export function isProjectSkipped(project: ProjectId): boolean {
  const at = projectSkippedAt[project];
  if (!at) return false;
  if (Date.now() - at > SKIP_TTL_MS) {
    delete projectSkippedAt[project];
    projectFailures[project] = 0;
    return false;
  }
  return true;
}

function markProjectFailure(project: ProjectId): void {
  if (isProjectSkipped(project)) return;
  projectFailures[project] += 1;
  if (projectFailures[project] >= FAILURES_TO_SKIP)
    projectSkippedAt[project] = Date.now();
}

function markProjectHealthy(project: ProjectId): void {
  projectFailures[project] = 0;
  delete projectSkippedAt[project];
}

/** Permission errors are transient (peer sign-in timing) — never skip on them. */
function isBlockingError(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? '';
  const message = (error as { message?: string })?.message ?? '';
  if (code === 'permission-denied' || /permission/i.test(message)) return false;
  return true;
}

const userProjectCache = new Map<string, ProjectId>();
const tweetProjectCache = new Map<string, ProjectId>();
const conversationProjectCache = new Map<string, ProjectId>();
const storyProjectCache = new Map<string, ProjectId>();

const PROBE_TIMEOUT_MS = 2500;

/** Reads the registry doc (public) to find which project a user lives on. */
async function registryProject(uid: string): Promise<ProjectId | null> {
  try {
    const snapshot = await withTimeout(
      getDoc(doc(getFirebase('a').firestore, 'userRegistry', uid)),
      PROBE_TIMEOUT_MS,
      null
    );
    const data = snapshot?.data() as { project?: unknown } | undefined;
    const project = data?.project;
    if (project === 'a' || project === 'b') return project;
  } catch {
    /* registry read is best-effort */
  }
  return null;
}

/** Checks both projects via the server proxy for a doc id. */
async function resolveDocProjectViaProxy(
  kind: 'users' | 'tweets' | 'stories' | 'conversations',
  id: string
): Promise<ProjectId | null> {
  for (const project of ['a', 'b'] as const) {
    const items = await withTimeout(
      queryViaProxy(project, { collection: kind, ids: [id], limit: 1 }),
      9000,
      null
    );
    if (items?.length) return project;
  }
  return null;
}

async function resolveProjectWith(
  id: string,
  cache: Map<string, ProjectId>,
  direct: (project: ProjectId) => Promise<boolean>,
  kind: 'users' | 'tweets' | 'stories' | 'conversations'
): Promise<ProjectId> {
  const cached = cache.get(id);
  if (cached) return cached;

  const results = await Promise.all([
    withTimeout(direct('a'), PROBE_TIMEOUT_MS, false),
    withTimeout(direct('b'), PROBE_TIMEOUT_MS, false)
  ]);
  let project: ProjectId;
  if (results[0]) project = 'a';
  else if (results[1]) project = 'b';
  else {
    const viaProxy = await resolveDocProjectViaProxy(kind, id);
    project = viaProxy ?? 'a';
  }
  cache.set(id, project);
  return project;
}

/** Resolves which project a user's profile lives in (cached, bounded). */
export async function resolveUserProject(uid: string): Promise<ProjectId> {
  const registered = await registryProject(uid);
  if (registered) {
    userProjectCache.set(uid, registered);
    return registered;
  }
  return resolveProjectWith(
    uid,
    userProjectCache,
    async (project) =>
      (
        await getDoc(doc(collectionsFor(project).users, uid)).catch(() => null)
      )?.exists() ?? false,
    'users'
  );
}

/** Resolves which project a tweet document lives in (cached, bounded). */
export async function resolveTweetProject(tweetId: string): Promise<ProjectId> {
  return resolveProjectWith(
    tweetId,
    tweetProjectCache,
    async (project) =>
      (
        await getDoc(doc(collectionsFor(project).tweets, tweetId)).catch(
          () => null
        )
      )?.exists() ?? false,
    'tweets'
  );
}

/** Resolves which project a conversation lives in (cached, bounded). */
export async function resolveConversationProject(
  conversationId: string
): Promise<ProjectId> {
  return resolveProjectWith(
    conversationId,
    conversationProjectCache,
    async (project) =>
      (
        await getDoc(
          doc(collectionsFor(project).conversations, conversationId)
        ).catch(() => null)
      )?.exists() ?? false,
    'conversations'
  );
}

/** Resolves which project a story/reel document lives in (cached, bounded). */
export async function resolveStoryProject(storyId: string): Promise<ProjectId> {
  return resolveProjectWith(
    storyId,
    storyProjectCache,
    async (project) =>
      (
        await getDoc(doc(collectionsFor(project).stories, storyId)).catch(
          () => null
        )
      )?.exists() ?? false,
    'stories'
  );
}

/** Fetches a user profile from whichever project it lives in (bounded, with
 * server-proxy fallback for blocked transports). */
export async function fetchUserAnywhere(uid: string): Promise<User | null> {
  if (!uid) return null;
  const project = await resolveUserProject(uid);
  const cols = collectionsFor(project);
  const snapshot = await withTimeout(
    getDoc(doc(cols.users, uid)).catch(() => null),
    2500,
    null
  );
  if (snapshot?.exists()) return snapshot.data();
  // Channel may be blocked — read through our server instead.
  const items = await withTimeout(
    queryViaProxy(project, { collection: 'users', ids: [uid], limit: 1 }),
    9000,
    null
  );
  if (items?.length) {
    userProjectCache.set(uid, project);
    return items[0].data as unknown as User;
  }
  return null;
}

type MergedOptions = {
  includeUser?: boolean;
  allowNull?: boolean;
  disabled?: boolean;
  /** Server-side read specs used to seed/poll data when a project's live
   * channel is blocked or slow. */
  fallback?: { a?: ProxySpec; b?: ProxySpec };
};

function fallbackUser(uid: string): User {
  return {
    id: uid,
    name: 'مستخدم مجهول',
    username: 'unknown',
    photoURL: '/assets/default-avatar.png',
    verified: false,
    bio: null,
    theme: null,
    accent: null,
    website: null,
    location: null,
    following: [],
    followers: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    totalTweets: 0,
    totalPhotos: 0,
    pinnedTweet: null,
    coverPhotoURL: null
  };
}

function createdAtMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const ts = value as { toMillis?: () => number; seconds?: number };
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return 0;
}

const SAFETY_TIMEOUT_MS = 8000;
const USER_FETCH_TIMEOUT_MS = 3500;
const B_GRACE_MS = 1200;
const POLL_MS = 12_000;

/**
 * Subscribes to the same query against BOTH projects and merges the results
 * (deduplicated by id, newest first), tagging each item with its project so
 * writes can target the right database.
 *
 * Resilient by design:
 * - data from EITHER project is published as soon as it arrives
 * - when a project's live channel is blocked/slow, its data is seeded and
 *   polled through the server-side read proxy instead
 * - permission errors never skip a project; genuine network failures skip it
 *   for a few minutes (proxy reads still work)
 */
export function useMergedCollection<
  T extends { id: string; createdAt: unknown }
>(
  queryA: Query<T> | null,
  queryB: Query<T> | null,
  options: MergedOptions & { includeUser: true }
): { data: (WithProject<T> & { user: User })[] | null; loading: boolean };

export function useMergedCollection<
  T extends { id: string; createdAt: unknown }
>(
  queryA: Query<T> | null,
  queryB: Query<T> | null,
  options?: MergedOptions
): { data: WithProject<T>[] | null; loading: boolean };

export function useMergedCollection<
  T extends { id: string; createdAt: unknown }
>(
  queryA: Query<T> | null,
  queryB: Query<T> | null,
  options?: MergedOptions
): {
  data: (WithProject<T> & { user?: User })[] | null;
  loading: boolean;
} {
  const [data, setData] = useState<(WithProject<T> & { user?: User })[] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const cancelled = useRef(false);
  const { includeUser, allowNull, disabled, fallback } = options ?? {};

  useEffect(() => {
    cancelled.current = false;
    if (disabled) {
      if (!allowNull) setData(null);
      setLoading(false);
      return;
    }

    const effA = queryA && !isProjectSkipped('a') ? queryA : null;
    const effB = queryB && !isProjectSkipped('b') ? queryB : null;

    if (!effA && !effB && !fallback?.a && !fallback?.b) {
      setData(allowNull ? [] : null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const items = new Map<string, WithProject<T>>();
    let anyDataArrived = false;
    // A side is "ok" when it has no query and no fallback (nothing to wait for).
    const sideOk: Record<ProjectId, boolean> = {
      a: effA ? false : !fallback?.a,
      b: effB ? false : !fallback?.b
    };

    const publish = (): void => {
      if (cancelled.current) return;
      const sorted = Array.from(items.values()).sort(
        (x, y) => createdAtMillis(y.createdAt) - createdAtMillis(x.createdAt)
      );

      if (includeUser) {
        void Promise.all(
          sorted.map(async (item) => {
            const createdBy = (item as unknown as { createdBy?: string })
              .createdBy;
            const user = createdBy
              ? (await withTimeout(
                  fetchUserAnywhere(createdBy),
                  USER_FETCH_TIMEOUT_MS,
                  null
                )) ?? fallbackUser(createdBy)
              : fallbackUser('');
            return { ...item, user } as WithProject<T> & { user: User };
          })
        ).then((withUsers) => {
          if (!cancelled.current) {
            setData(withUsers);
            setLoading(false);
          }
        });
      } else {
        setData(sorted);
        setLoading(false);
      }
    };

    /** Seeds/polls a project through the server proxy (blocked-channel path). */
    const mergeProxy = (project: ProjectId, spec?: ProxySpec): void => {
      if (!spec || cancelled.current) return;
      void withTimeout(queryViaProxy(project, spec), 10_000, null).then(
        (list) => {
          if (cancelled.current || !list) return;
          list.forEach(({ id, data: itemData }) => {
            items.set(id, { ...(itemData as unknown as T), project });
          });
          if (list.length) anyDataArrived = true;
          publish();
        }
      );
    };

    // Seed both sides immediately — data appears even when channels are blocked.
    mergeProxy('a', fallback?.a);
    mergeProxy('b', fallback?.b);

    // Keep polling sides whose live channel never answered.
    const poll = setInterval(() => {
      if (cancelled.current) return;
      if (!sideOk.a) mergeProxy('a', fallback?.a);
      if (!sideOk.b) mergeProxy('b', fallback?.b);
    }, POLL_MS);

    const subscribe = (
      project: ProjectId,
      q: Query<T> | null
    ): (() => void) | null => {
      if (!q) return null;
      return onSnapshot(
        q,
        (snapshot) => {
          if (cancelled.current) return;
          markProjectHealthy(project);
          sideOk[project] = true;
          snapshot.docs.forEach((docSnap) => {
            items.set(docSnap.id, {
              ...docSnap.data(),
              project
            } as WithProject<T>);
          });
          anyDataArrived = true;
          publish();
        },
        (error) => {
          if (cancelled.current) return;
          if (isBlockingError(error)) markProjectFailure(project);
          // Publish whatever the other side / proxy already gave us.
          publish();
        }
      );
    };

    const unsubscribes: (() => void)[] = [];
    const subA = subscribe('a', effA);
    if (subA) unsubscribes.push(subA);

    // Grace period for the secondary project: lets the peer sign-in settle
    // before subscribing, so permission errors don't fire needlessly.
    let subB: (() => void) | null = null;
    const bTimer = setTimeout(() => {
      if (cancelled.current) return;
      subB = subscribe('b', effB);
      if (subB) unsubscribes.push(subB);
    }, B_GRACE_MS);

    // Safety net: release the loading state no matter what.
    const safety = setTimeout(() => {
      if (cancelled.current) return;
      publish();
      setLoading(false);
    }, SAFETY_TIMEOUT_MS);

    return () => {
      cancelled.current = true;
      clearTimeout(bTimer);
      clearTimeout(safety);
      clearInterval(poll);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryA, queryB, includeUser, allowNull, disabled]);

  return { data, loading };
}

/** The project a query item belongs to (defaults to the active session). */
export function projectOf(item: { project?: ProjectId }): ProjectId {
  return item.project ?? 'a';
}

export { otherProject };

type AnywhereKind = 'users' | 'tweets' | 'stories' | 'conversations';

const kindResolvers: Record<AnywhereKind, (id: string) => Promise<ProjectId>> =
  {
    users: resolveUserProject,
    tweets: resolveTweetProject,
    stories: resolveStoryProject,
    conversations: resolveConversationProject
  };

const kindCollections: Record<
  AnywhereKind,
  keyof ReturnType<typeof collectionsFor>
> = {
  users: 'users',
  tweets: 'tweets',
  stories: 'stories',
  conversations: 'conversations'
};

/**
 * Resolves which project a document lives in, then exposes the correct
 * DocumentReference. Used by components that subscribe to a single doc
 * (profile, tweet detail, conversation…) which may live in either database.
 * Bounded and proxy-aware: falls back to the primary project if the peer is
 * unreachable.
 */
export function useAnywhereRef<T = DocumentData>(
  kind: AnywhereKind,
  id: string | null | undefined
): { ref: DocumentReference<T> | null; project: ProjectId | null } {
  const [project, setProject] = useState<ProjectId | null>(null);

  useEffect(() => {
    setProject(null);
    if (!id) return;
    let cancelled = false;
    void withTimeout(
      kindResolvers[kind](id),
      PROBE_TIMEOUT_MS * 2 + 9000,
      'a'
    ).then((resolved) => {
      if (!cancelled) setProject(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  if (!project || !id) return { ref: null, project: null };
  const cols = collectionsFor(project);
  const collectionRef = cols[kindCollections[kind]] as CollectionReference<
    Record<string, unknown>
  >;
  return {
    ref: doc(collectionRef, id) as DocumentReference<T>,
    project
  };
}
