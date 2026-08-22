import {
  useState,
  useEffect,
  useContext,
  createContext,
  useMemo,
  useRef,
  useCallback
} from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut as signOutFirebase
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  where
} from 'firebase/firestore';
import {
  getFirebase,
  signIntoPeer,
  signOutBoth,
  storeProject,
  readStoredProject
} from '@lib/firebase/app';
import { collectionsFor } from '@lib/firebase/collections';
import { resolveUserProject } from '@lib/dual';
import { getRandomId, getRandomInt } from '@lib/random';
import { checkUsernameAvailability } from '@lib/firebase/utils';
import { usernameToInternalEmail } from '@lib/utils';
import { registerWebPushToken } from '@lib/native-bridge';
import type { ProjectId } from '@lib/project-types';
import type { ReactNode } from 'react';
import type { User as AuthUser } from 'firebase/auth';
import type { WithFieldValue } from 'firebase/firestore';
import type { User } from '@lib/types/user';

import type { Stats } from '@lib/types/stats';

type SignUpData = {
  name: string;
  username: string;
  password: string;
};

type AuthContext = {
  user: User | null;
  error: Error | null;
  loading: boolean;
  isAdmin: boolean;
  randomSeed: string;
  unreadNotifications: number;
  /** Which round-robin database this account lives in. */
  project: ProjectId;
  signOut: () => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<void>;
  signUpWithUsername: (data: SignUpData) => Promise<void>;
  /** Locally mark a user's story as seen so the ring disappears instantly. */
  markStoryViewed: (storyUserId: string) => void;
};

export const AuthContext = createContext<AuthContext | null>(null);

type AuthContextProviderProps = {
  children: ReactNode;
};

/** Posts JSON to a server route and returns the parsed body (bounded). */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = (await response.json().catch(() => ({}))) as T & {
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? 'request_failed');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function AuthContextProvider({
  children
}: AuthContextProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProjectState] = useState<ProjectId>(readStoredProject);
  const processedUid = useRef<string | null>(null);

  const setProject = (next: ProjectId): void => {
    storeProject(next);
    setProjectState(next);
  };

  // The auth subscription follows the active project (round-robin database).
  // We listen to BOTH projects' auth so a session that lives on the other
  // database is still picked up, then auto-correct the stored project.
  const authA = getFirebase('a').auth;
  const authB = getFirebase('b').auth;

  useEffect(() => {
    let cancelled = false;

    const activateProjectFor = (authUser: AuthUser): void => {
      // If the signed-in user belongs to the other project (checked via the
      // registry), switch the whole app to that project.
      const current = readStoredProject();
      void resolveUserProject(authUser.uid).then((resolved) => {
        if (cancelled) return;
        if (resolved && resolved !== current) {
          storeProject(resolved);
          setProjectState(resolved);
        }
      });
    };

    const manageUser = async (authUser: AuthUser): Promise<void> => {
      const { uid, displayName, photoURL } = authUser;

      if (!uid || processedUid.current === uid) return;

      setLoading(true);
      processedUid.current = uid;

      // استخدم بيانات التسجيل المحلية (الاسم + اسم المستخدم) إن توفرت
      // لتجنب استبدالها بالافتراضي "مستخدم..." عند أول دخول
      let pendingData: { name?: string; username?: string } | null = null;
      try {
        const storageKey = `aite:pending-profile:${uid}`;
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          pendingData = JSON.parse(raw) as {
            name?: string;
            username?: string;
          };
          sessionStorage.removeItem(storageKey);
        }
      } catch {
        /* القراءة محمولة — لا تُوقف التدفق */
      }

      const fallbackName = pendingData?.name ?? displayName ?? 'مستخدم';
      const fallbackPhoto = photoURL ?? '/assets/default-avatar.png';

      // Always use the user's REAL round-robin project (registry -> probes ->
      // proxy), never the possibly-stale stored project.
      const userProject = await resolveUserProject(uid);
      const cols = collectionsFor(userProject);

      // قراءة الملف مع إعادة محاولة — لا نترك المستخدم عالقًا بسبب خطأ عابر
      let userSnapshot;
      try {
        userSnapshot = await getDoc(doc(cols.users, uid));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 800));
        userSnapshot = await getDoc(doc(cols.users, uid));
      }

      const defaultUserData: User = {
        id: uid,
        bio: null,
        name: fallbackName,
        theme: null,
        accent: null,
        website: null,
        location: null,
        photoURL: fallbackPhoto,
        username: '',
        verified: false,
        following: [],
        followers: [],
        createdAt: Timestamp.now(),
        updatedAt: null,
        totalTweets: 0,
        totalPhotos: 0,
        pinnedTweet: null,
        coverPhotoURL: null
      };

      if (!userSnapshot.exists()) {
        let randomUsername = '';

        // اسم المستخدم المُدخل عند التسجيل له الأولوية — لا نولّد اسماً عشوائياً بدلائه
        if (
          pendingData?.username &&
          (await checkUsernameAvailability(pendingData.username))
        ) {
          randomUsername = pendingData.username;
        } else {
          let available = false;
          while (!available) {
            const normalizeName = fallbackName.replace(/\s/g, '').toLowerCase();
            const randomInt = getRandomInt(1, 10_000);

            randomUsername = `${normalizeName}${randomInt}`;

            const isUsernameAvailable = await checkUsernameAvailability(
              randomUsername
            );

            if (isUsernameAvailable) available = true;
          }
        }

        const userData: WithFieldValue<User> = {
          id: uid,
          bio: null,
          name: fallbackName,
          theme: null,
          accent: null,
          website: null,
          location: null,
          photoURL: fallbackPhoto,
          username: randomUsername,
          verified: false,
          following: [],
          followers: [],
          createdAt: serverTimestamp(),
          updatedAt: null,
          totalTweets: 0,
          totalPhotos: 0,
          pinnedTweet: null,
          coverPhotoURL: null
        };

        const userStatsData: WithFieldValue<Stats> = {
          likes: [],
          tweets: [],
          updatedAt: null
        };

        try {
          await Promise.all([
            setDoc(doc(cols.users, uid), userData),
            setDoc(doc(cols.userStats(uid), 'stats'), userStatsData)
          ]);

          const newUser = (await getDoc(doc(cols.users, uid))).data();
          setUser({ ...defaultUserData, ...newUser } as User);
        } catch (error) {
          setError(error as Error);
        }
      } else {
        const userData = userSnapshot.data();
        setUser({ ...defaultUserData, ...userData } as User);
      }

      setLoading(false);
    };

    const handleAuthUser = (
      source: typeof authA,
      authUser: AuthUser | null
    ): void => {
      if (cancelled) return;
      if (authUser) {
        if (processedUid.current === authUser.uid) return;
        activateProjectFor(authUser);
        void manageUser(authUser).catch((error) => {
          setError(error as Error);
          setLoading(false);
        });
      } else {
        // Only clear when BOTH auths report no user.
        const other = source === authA ? authB : authA;
        if (other.currentUser != null) return;
        setUser(null);
        // تصفير المعرّف يسمح بإعادة الدخول بنفس الحساب بعد الخروج دون تحديث الصفحة
        processedUid.current = null;
        setLoading(false);
      }
    };

    const unsubscribeA = onAuthStateChanged(authA, (u) =>
      handleAuthUser(authA, u)
    );
    const unsubscribeB = onAuthStateChanged(authB, (u) =>
      handleAuthUser(authB, u)
    );

    return () => {
      cancelled = true;
      unsubscribeA();
      unsubscribeB();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Web app (PWA): persist the FCM token on the user doc so
  // the server can push message notifications; re-register on token refresh.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    void registerWebPushToken(userId);
    // Sign into the OTHER database too, so cross-project content (feeds,
    // profiles, messages) is readable from either project.
    void signIntoPeer(project);
    const handleToken = (): void => void registerWebPushToken(userId);
    window.addEventListener('aite-fcm-token', handleToken);

    return () => window.removeEventListener('aite-fcm-token', handleToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Presence heartbeat: claim "online" immediately then refresh every 5
  // minutes (with a client-side fresher guard so visibility flaps never
  // burn extra Firestore writes). Keeps the green dot alive within the
  // presence window defined in presence-store without exhausting the
  // daily write quota on Spark projects.
  const HEARTBEAT_MS = 5 * 60 * 1000;
  const HEARTBEAT_FREQUENT_GUARD_MS = HEARTBEAT_MS / 2;
  const lastBeatRef = useRef<number>(0);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    let cancelled = false;
    const beatRef: { current: ((force?: boolean) => void) | null } = {
      current: null
    };
    lastBeatRef.current = 0;

    // Write the heartbeat to the user's OWN round-robin database (resolved
    // via the public registry), never the default project.
    void resolveUserProject(userId).then((userProject) => {
      if (cancelled) return;
      const cols = collectionsFor(userProject);
      beatRef.current = (force = false): void => {
        const now = Date.now();
        if (!force && now - lastBeatRef.current < HEARTBEAT_FREQUENT_GUARD_MS)
          return;
        lastBeatRef.current = now;
        void updateDoc(doc(cols.users, userId), {
          lastActiveAt: serverTimestamp()
        }).catch(() => null);
      };
      if (userProject) beatRef.current(true);
    });

    const beat = (force = false): void => beatRef.current?.(force);
    const handleVisibilityBeat = (): void => {
      if (document.visibilityState === 'visible') beatRef.current?.(true);
    };
    beat(true);
    document.addEventListener('visibilitychange', handleVisibilityBeat);
    const interval = setInterval(() => beatRef.current?.(), HEARTBEAT_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityBeat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const { id } = user;
    const cols = collectionsFor(project);

    const unsubscribeUser = onSnapshot(
      doc(cols.users, id),
      (doc) => {
        setUser(
          (prevUser) => ({ ...prevUser, ...(doc.data() as User) } as User)
        );
      },
      (error) => {
        console.error('user snapshot error:', error);
      }
    );

    const unsubscribeNotifications = onSnapshot(
      query(cols.notifications(id), where('read', '==', false)),
      (snapshot) => setUnreadNotifications(snapshot.size),
      (error) => {
        console.error('notifications count error:', error);
        setUnreadNotifications(0);
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeNotifications();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toArabicAuthError = (error: unknown): Error => {
    const code = (error as { code?: string })?.code ?? '';
    const map: Record<string, string> = {
      'auth/invalid-credential':
        'اسم المستخدم أو كلمة المرور غير صحيحة — إن أنشأت حسابك عبر Google فسجّل بزر Google',
      'auth/wrong-password':
        'اسم المستخدم أو كلمة المرور غير صحيحة — إن أنشأت حسابك عبر Google فسجّل بزر Google',
      'auth/user-not-found': 'لا يوجد حساب بهذا الاسم',
      'auth/too-many-requests': 'محاولات كثيرة — انتظر قليلًا ثم حاول مجددًا',
      'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
      'auth/email-already-in-use': 'اسم المستخدم مسجل مسبقًا',
      'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
      'auth/popup-closed-by-user': 'أُلغي تسجيل الدخول عبر Google'
    };
    return new Error(map[code] ?? 'تعذر تسجيل الدخول — حاول مرة أخرى');
  };

  const signInWithUsername = async (
    username: string,
    password: string
  ): Promise<void> => {
    try {
      const cleaned = username.trim().toLowerCase();
      // يوجّه الحساب إلى قاعدته (الأساسية أو aite-76) عبر سجل التوجيه.
      let targetProject: ProjectId = readStoredProject();
      try {
        const routed = await postJson<{ found?: boolean; project?: ProjectId }>(
          '/api/auth/route',
          { identifier: cleaned }
        );
        if (routed.found && routed.project) targetProject = routed.project;
      } catch {
        // فشل التوجيه — نجرّب المشروع الحالي ثم الأساسي
      }

      setProject(targetProject);
      const email = usernameToInternalEmail(cleaned);
      const targetAuth = getFirebase(targetProject).auth;
      try {
        await signInWithEmailAndPassword(targetAuth, email, password);
      } catch (error) {
        // احتياط: الحساب قد يكون في المشروع الآخر (سجل توجيه قديم/ناقص)
        const fallbackProject: ProjectId = targetProject === 'a' ? 'b' : 'a';
        const fallbackAuth = getFirebase(fallbackProject).auth;
        await signInWithEmailAndPassword(fallbackAuth, email, password);
        setProject(fallbackProject);
      }
    } catch (error) {
      setError(toArabicAuthError(error));
      throw toArabicAuthError(error);
    }
  };

  const signUpWithUsername = async ({
    name,
    username,
    password
  }: SignUpData): Promise<void> => {
    try {
      const isAvailable = await checkUsernameAvailability(username);

      if (!isAvailable) {
        const error = new Error('اسم المستخدم غير متاح');
        setError(error);
        throw error;
      }

      // إنشاء الحساب عبر الخادم: يختار القاعدة بالتناوب (الأساسية ↔ aite-76)
      // ويسجّل الحساب في سجل التوجيه.
      const result = await postJson<{ project: ProjectId; email: string }>(
        '/api/auth/signup',
        { username, password, name }
      );

      setProject(result.project);
      const email = result.email ?? usernameToInternalEmail(username);

      const { user: authUser } = await signInWithEmailAndPassword(
        getFirebase(result.project).auth,
        email,
        password
      );

      // خزّن الاسم المُدخل مؤقتًا حتى يستخدمه manageUser عند إنشاء الملف
      try {
        sessionStorage.setItem(
          `aite:pending-profile:${authUser.uid}`,
          JSON.stringify({ name, username })
        );
      } catch {
        /* تخزين محمول — لا يؤثر على التسجيل */
      }

      const defaultPhotoURL = '/assets/default-avatar.png';

      await updateProfile(authUser, {
        displayName: name,
        photoURL: defaultPhotoURL
      });
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (typeof window !== 'undefined')
        window.sessionStorage.setItem('aite:post-logout', '1');
      await signOutBoth(project);
    } catch (error) {
      setError(error as Error);
    }
  };

  const isAdmin = false;
  const randomSeed = useMemo(getRandomId, [user?.id]);

  const markStoryViewed = useCallback((storyUserId: string): void => {
    setUser((prevUser) => {
      if (!prevUser) return prevUser;
      // لا تعيد التسجيل إن كانت القصة مشاهدة — يمنع حلقة تحديثات لا نهائية
      if (prevUser.storyViews?.[storyUserId]) return prevUser;
      return {
        ...prevUser,
        storyViews: {
          ...(prevUser.storyViews ?? {}),
          [storyUserId]: Timestamp.now()
        }
      };
    });
  }, []);

  const value: AuthContext = {
    user,
    error,
    loading,
    isAdmin,
    randomSeed,
    unreadNotifications,
    project,
    signOut,
    signInWithUsername,
    signUpWithUsername,
    markStoryViewed
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContext {
  const context = useContext(AuthContext);

  if (!context)
    throw new Error('useAuth must be used within an AuthContextProvider');

  return context;
}
