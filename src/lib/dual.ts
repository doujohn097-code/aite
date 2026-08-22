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

const userProjectCache = new Map<string, ProjectId>();
const tweetProjectCache = new Map<string, ProjectId>();
const conversationProjectCache = new Map<string, ProjectId>();

/** Reads the registry doc (public) to find which project a user lives on. */
async function registryProject(uid: string): Promise<ProjectId | null> {
  try {
    const snapshot = await getDoc(
      doc(getFirebase('a').firestore, 'userRegistry', uid)
    );
    const data = snapshot.data() as { project?: unknown } | undefined;
    const project = data?.project;
    if (project === 'a' || project === 'b') return project;
  } catch {
    /* registry read is best-effort */
  }
  return null;
}

/** Resolves which project a user's profile lives in (cached). */
export async function resolveUserProject(uid: string): Promise<ProjectId> {
  const cached = userProjectCache.get(uid);
  if (cached) return cached;
  const registered = await registryProject(uid);
  if (registered) {
    userProjectCache.set(uid, registered);
    return registered;
  }
  // Fallback: try the primary project doc, then the secondary.
  const colsA = collectionsFor('a');
  const colsB = collectionsFor('b');
  const [snapA, snapB] = await Promise.all([
    getDoc(doc(colsA.users, uid)).catch(() => null),
    getDoc(doc(colsB.users, uid)).catch(() => null)
  ]);
  const project: ProjectId = snapA?.exists()
    ? 'a'
    : snapB?.exists()
    ? 'b'
    : 'a';
  userProjectCache.set(uid, project);
  return project;
}

/** Resolves which project a tweet document lives in (cached). */
export async function resolveTweetProject(tweetId: string): Promise<ProjectId> {
  const cached = tweetProjectCache.get(tweetId);
  if (cached) return cached;
  const [snapA, snapB] = await Promise.all([
    getDoc(doc(collectionsFor('a').tweets, tweetId)).catch(() => null),
    getDoc(doc(collectionsFor('b').tweets, tweetId)).catch(() => null)
  ]);
  const project: ProjectId = snapA?.exists()
    ? 'a'
    : snapB?.exists()
    ? 'b'
    : 'a';
  tweetProjectCache.set(tweetId, project);
  return project;
}

/** Resolves which project a conversation lives in (cached). */
export async function resolveConversationProject(
  conversationId: string
): Promise<ProjectId> {
  const cached = conversationProjectCache.get(conversationId);
  if (cached) return cached;
  const [snapA, snapB] = await Promise.all([
    getDoc(doc(collectionsFor('a').conversations, conversationId)).catch(
      () => null
    ),
    getDoc(doc(collectionsFor('b').conversations, conversationId)).catch(
      () => null
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

const storyProjectCache = new Map<string, ProjectId>();

/** Resolves which project a story/reel document lives in (cached). */
export async function resolveStoryProject(storyId: string): Promise<ProjectId> {
  const cached = storyProjectCache.get(storyId);
  if (cached) return cached;
  const [snapA, snapB] = await Promise.all([
    getDoc(doc(collectionsFor('a').stories, storyId)).catch(() => null),
    getDoc(doc(collectionsFor('b').stories, storyId)).catch(() => null)
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
    getDoc(refA).catch(() => null),
    getDoc(refB).catch(() => null)
  ]);
  if (snapA?.exists()) return { doc: snapA, project: 'a' };
  if (snapB?.exists()) return { doc: snapB, project: 'b' };
  return { doc: null, project: null };
}

/** Fetches a user profile from whichever project it lives in. */
export async function fetchUserAnywhere(uid: string): Promise<User | null> {
  const project = await resolveUserProject(uid);
  const cols = collectionsFor(project);
  const snapshot = await getDoc(doc(cols.users, uid)).catch(() => null);
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

/**
 * Subscribes to the same query against BOTH projects and merges the results
 * (deduplicated by id, newest first), tagging each item with its project so
 * writes can target the right database.
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
  const [data, setData] = useState<WithProject<T>[] | null>(null);
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
    if (!queryA && !queryB) {
      if (!allowNull) setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const items = new Map<string, WithProject<T>>();
    let loadedA = !queryA;
    let loadedB = !queryB;

    const publish = (): void => {
      if (!loadedA || !loadedB) return;
      const sorted = Array.from(items.values()).sort((x, y) => {
        const tx = (x.createdAt as Timestamp | Date | number | null) ?? 0;
        const ty = (y.createdAt as Timestamp | Date | number | null) ?? 0;
        const ax =
          typeof tx === 'number' ? tx : (tx as Timestamp).toMillis?.() ?? 0;
        const ay =
          typeof ty === 'number' ? ty : (ty as Timestamp).toMillis?.() ?? 0;
        return ay - ax;
      });
      if (cancelled.current) return;

      if (includeUser) {
        void Promise.all(
          sorted.map(async (item) => {
            const createdBy = (item as unknown as { createdBy?: string })
              .createdBy;
            const user = createdBy
              ? (await fetchUserAnywhere(createdBy)) ?? fallbackUser(createdBy)
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

    const takeSnapshot = (
      project: ProjectId,
      snapshot: { docs: { id: string; data: () => T }[] }
    ): void => {
      snapshot.docs.forEach((docSnap) => {
        items.set(docSnap.id, { ...docSnap.data(), project });
      });
    };

    const unsubscribes: (() => void)[] = [];
    if (queryA) {
      unsubscribes.push(
        onSnapshot(
          queryA,
          (snapshot) => {
            takeSnapshot('a', snapshot);
            loadedA = true;
            publish();
          },
          () => {
            loadedA = true;
            publish();
          }
        )
      );
    }
    if (queryB) {
      unsubscribes.push(
        onSnapshot(
          queryB,
          (snapshot) => {
            takeSnapshot('b', snapshot);
            loadedB = true;
            publish();
          },
          () => {
            loadedB = true;
            publish();
          }
        )
      );
    }

    return () => {
      cancelled.current = true;
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
    void kindResolvers[kind](id).then((resolved) => {
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
