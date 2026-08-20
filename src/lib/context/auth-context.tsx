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
import { auth } from '@lib/firebase/app';
import {
  usersCollection,
  userStatsCollection,
  notificationsCollection
} from '@lib/firebase/collections';
import { getRandomId, getRandomInt } from '@lib/random';
import { checkUsernameAvailability } from '@lib/firebase/utils';
import { usernameToInternalEmail } from '@lib/utils';
import { registerNativePushToken } from '@lib/native-bridge';
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

export function AuthContextProvider({
  children
}: AuthContextProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const processedUid = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

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

      // قراءة الملف مع إعادة محاولة — لا نترك المستخدم عالقًا بسبب خطأ عابر
      let userSnapshot;
      try {
        userSnapshot = await getDoc(doc(usersCollection, uid));
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 800));
        userSnapshot = await getDoc(doc(usersCollection, uid));
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
            setDoc(doc(usersCollection, uid), userData),
            setDoc(doc(userStatsCollection(uid), 'stats'), userStatsData)
          ]);

          const newUser = (await getDoc(doc(usersCollection, uid))).data();
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

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (cancelled) return;
      if (authUser) {
        if (processedUid.current === authUser.uid) return;
        void manageUser(authUser).catch((error) => {
          setError(error as Error);
          setLoading(false);
        });
      } else {
        setUser(null);
        // تصفير المعرّف يسمح بإعادة الدخول بنفس الحساب بعد الخروج دون تحديث الصفحة
        processedUid.current = null;
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Native app (Android WebView): persist the FCM token on the user doc so
  // the server can push message notifications; re-register on token refresh.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    void registerNativePushToken(userId);
    const handleToken = (): void => void registerNativePushToken(userId);
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
    lastBeatRef.current = 0;

    const beat = (force = false): void => {
      const now = Date.now();
      if (!force && now - lastBeatRef.current < HEARTBEAT_FREQUENT_GUARD_MS)
        return;
      lastBeatRef.current = now;
      void updateDoc(doc(usersCollection, userId), {
        lastActiveAt: serverTimestamp()
      }).catch(() => null);
    };

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') beat();
    };

    beat(true);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = setInterval(beat, HEARTBEAT_MS);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const { id } = user;

    const unsubscribeUser = onSnapshot(
      doc(usersCollection, id),
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
      query(notificationsCollection(id), where('read', '==', false)),
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
      const email = usernameToInternalEmail(username);
      await signInWithEmailAndPassword(auth, email, password);
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

      const email = usernameToInternalEmail(username);

      const { user: authUser } = await createUserWithEmailAndPassword(
        auth,
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

      const userData: WithFieldValue<User> = {
        id: authUser.uid,
        bio: null,
        name,
        theme: null,
        accent: null,
        website: null,
        location: null,
        photoURL: defaultPhotoURL,
        username,
        verified: false,
        following: [],
        followers: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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

      await Promise.all([
        setDoc(doc(usersCollection, authUser.uid), userData),
        setDoc(doc(userStatsCollection(authUser.uid), 'stats'), userStatsData)
      ]);
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (typeof window !== 'undefined')
        window.sessionStorage.setItem('aite:post-logout', '1');
      await signOutFirebase(auth);
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
