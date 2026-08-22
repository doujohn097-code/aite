import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@lib/firebase/app';
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
// Project health (degraded mode)
//
// When a project's queries keep failing (ad blocker, revoked permissions,
// unreachable network), we stop subscribing to it for the session instead of
// letting it block/glitch the whole UI. The other project keeps working.
// ---------------------------------------------------------------------------

const FAILURES_TO_SKIP = 2;
const SKIP_TTL_MS = 10 * 60 * 1000;

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

const userProjectCache = new Map<string, ProjectId>();
const tweetProjectCache = new Map<string, ProjectId>();
const conversationProjectCache = new Map<string, ProjectId>();
const storyProjectCache = new Map<string, ProjectId>();

const PROBE_TIMEOUT_MS = 3000;

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

/** Resolves which project a user's profile lives in (cached, bounded). */
export async function resolveUserProject(uid: string): Promise<ProjectId> {
  const cached = userProjectCache.get(uid);
  if (cached) return cached;
  const registered = await registryProject(uid);
  if (registered) {
    userProjectCache.set(uid, registered);
    return registered;
  }
  // Fallback: probe both projects (bounded) — never hang the UI.
  const [snapA, snapB] = await Promise.all([
    withTimeout(
      getDoc(doc(collectionsFor('a').users, uid)).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    ),
    withTimeout(
      getDoc(doc(collectionsFor('b').users, uid)).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    )
  ]);
  const project: ProjectId = snapA?.exists()
    ? 'a'
    : snapB?.exists()
    ? 'b'
    : 'a';
  userProjectCache.set(uid, project);
  return project;
}

/** Resolves which project a tweet document lives in (cached, bounded). */
export async function resolveTweetProject(tweetId: string): Promise<ProjectId> {
  const cached = tweetProjectCache.get(tweetId);
  if (cached) return cached;
  const [snapA, snapB] = await Promise.all([
    withTimeout(
      getDoc(doc(collectionsFor('a').tweets, tweetId)).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    ),
    withTimeout(
      getDoc(doc(collectionsFor('b').tweets, tweetId)).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    )
  ]);
  const project: ProjectId = snapA?.exists()
    ? 'a'
    : snapB?.exists()
    ? 'b'
    : 'a';
  tweetProjectCache.set(tweetId, project);
  return project;
}

/** Resolves which project a conversation lives in (cached, bounded). */
export async function resolveConversationProject(
  conversationId: string
): Promise<ProjectId> {
  const cached = conversationProjectCache.get(conversationId);
  if (cached) return cached;
  const [snapA, snapB] = await Promise.all([
    withTimeout(
      getDoc(doc(collectionsFor('a').conversations, conversationId)).catch(
        () => null
      ),
      PROBE_TIMEOUT_MS,
      null
    ),
    withTimeout(
      getDoc(doc(collectionsFor('b').conversations, conversationId)).catch(
        () => null
      ),
      PROBE_TIMEOUT_MS,
      null
    )
  ]);
  const project: ProjectId = snapA?.exists()
    ? 'a'
    : snapB?.exists()
    ? 'b'
    : 'a';
  conversationProjectCache.set(conversationId, project);
  return project;
}

/** Resolves which project a story/reel document lives in (cached, bounded). */
export async function resolveStoryProject(storyId: string): Promise<ProjectId> {
  const cached = storyProjectCache.get(storyId);
  if (cached) return cached;
  const [snapA, snapB] = await Promise.all([
    withTimeout(
      getDoc(doc(collectionsFor('a').stories, storyId)).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    ),
    withTimeout(
      getDoc(doc(collectionsFor('b').stories, storyId)).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    )
  ]);
  const project: ProjectId = snapA?.exists()
    ? 'a'
    : snapB?.exists()
    ? 'b'
    : 'a';
  storyProjectCache.set(storyId, project);
  return project;
}

/** Reads a doc from either project and returns (doc, project). */
export async function getDocBoth<T = DocumentData>(
  refA: DocumentReference<T>,
  refB: DocumentReference<T>
): Promise<{
  doc: Awaited<ReturnType<typeof getDoc<T>>> | null;
  project: ProjectId | null;
}> {
  const [snapA, snapB] = await Promise.all([
    withTimeout(
      getDoc(refA).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    ),
    withTimeout(
      getDoc(refB).catch(() => null),
      PROBE_TIMEOUT_MS,
      null
    )
  ]);
  if (snapA?.exists()) return { doc: snapA, project: 'a' };
  if (snapB?.exists()) return { doc: snapB, project: 'b' };
  return { doc: null, project: null };
}

/** Fetches a user profile from whichever project it lives in (bounded). */
export async function fetchUserAnywhere(uid: string): Promise<User | null> {
  if (!uid) return null;
  const project = await resolveUserProject(uid);
  const cols = collectionsFor(project);
  const snapshot = await withTimeout(
    getDoc(doc(cols.users, uid)).catch(() => null),
    PROBE_TIMEOUT_MS,
    null
  );
  return snapshot?.exists() ? snapshot.data() : null;
}

type MergedOptions = {
  includeUser?: boolean;
  allowNull?: boolean;
  disabled?: boolean;
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
const USER_FETCH_TIMEOUT_MS = 4000;

/**
 * Subscribes to the same query against BOTH projects and merges the results
 * (deduplicated by id, newest first), tagging each item with its project so
 * writes can target the right database.
 *
 * Resilient by design: data from EITHER project is published as soon as it
 * arrives — a blocked/slow/erroring project can never hold the UI hostage.
 * After repeated failures a project is skipped for the session.
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
  const { includeUser, allowNull, disabled } = options ?? {};

  useEffect(() => {
    cancelled.current = false;
    if (disabled) {
      if (!allowNull) setData(null);
      setLoading(false);
      return;
    }

    // Skip projects that have been failing repeatedly this session.
    const effectiveA = queryA && !isProjectSkipped('a') ? queryA : null;
    const effectiveB = queryB && !isProjectSkipped('b') ? queryB : null;

    if (!effectiveA && !effectiveB) {
      setData(allowNull ? [] : null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const items = new Map<string, WithProject<T>>();
    let anyDataArrived = false;

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
          snapshot.docs.forEach((docSnap) => {
            items.set(docSnap.id, {
              ...docSnap.data(),
              project
            } as WithProject<T>);
          });
          anyDataArrived = true;
          publish();
        },
        () => {
          if (cancelled.current) return;
          markProjectFailure(project);
          // Publish whatever the other project already gave us.
          publish();
        }
      );
    };

    const unsubscribes: (() => void)[] = [];
    const subA = subscribe('a', effectiveA);
    const subB = subscribe('b', effectiveB);
    if (subA) unsubscribes.push(subA);
    if (subB) unsubscribes.push(subB);

    // Safety net: if nothing arrived at all (blocked channels), release the
    // loading state and show whatever we have (possibly empty). Do NOT mark
    // failures here — cold starts can legitimately take a while.
    const safety = setTimeout(() => {
      if (cancelled.current) return;
      publish();
      setLoading(false);
    }, SAFETY_TIMEOUT_MS);

    return () => {
      cancelled.current = true;
      clearTimeout(safety);
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
 * Bounded: falls back to the primary project if the peer is unreachable.
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
      PROBE_TIMEOUT_MS + 3000,
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
