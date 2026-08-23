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
import { auth, db } from '@lib/firebase/app';
import {
  usersCollection,
  userStatsCollection,
  notificationsCollection
} from '@lib/firebase/collections';
import { getRandomId, getRandomInt } from '@lib/random';
import { checkUsernameAvailability } from '@lib/firebase/utils';
import { usernameToInternalEmail } from '@lib/utils';
import { registerWebPushToken } from '@lib/native-bridge';
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

      if (!uid) return;
      if (processedUid.current === uid) return;

      setLoading(true);
      processedUid.current = uid;

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
        // ignore
      }

      const fallbackName = pendingData?.name ?? displayName ?? 'مستخدم';
      const fallbackPhoto = photoURL ?? '/assets/default-avatar.png';

      // قراءة الملف مع إعادة محاولة
      let userSnapshot;
      try {
        userSnapshot = await getDoc(doc(usersCollection, uid));
      } catch (err) {
        console.warn('first getDoc failed, retrying', err);
        await new Promise((resolve) => setTimeout(resolve, 800));
        try {
          userSnapshot = await getDoc(doc(usersCollection, uid));
        } catch (err2) {
          console.error('second getDoc failed', err2);
          // لا نترك المستخدم عالقًا - نعيد المحاولة لاحقًا
          processedUid.current = null;
          setLoading(false);
          return;
        }
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
        let finalUsername = '';

        if (pendingData?.username) {
          try {
            const avail = await checkUsernameAvailability(pendingData.username);
            if (avail) finalUsername = pendingData.username;
          } catch {
            // إذا فشل التحقق بسبب الصلاحيات، نستخدم الاسم المُدخل مباشرة
            finalUsername = pendingData.username;
          }
        }

        if (!finalUsername) {
          // توليد اسم مستخدم عشوائي متاح
          let tries = 0;
          while (tries < 15) {
            const normalizeName =
              fallbackName.replace(/\s/g, '').toLowerCase().slice(0, 8) ||
              'user';
            const randomInt = getRandomInt(1, 10_000);
            const candidate = `${normalizeName}${randomInt}`;
            try {
              const isAvailable = await checkUsernameAvailability(candidate);
              if (isAvailable) {
                finalUsername = candidate;
                break;
              }
            } catch {
              finalUsername = candidate;
              break;
            }
            tries++;
          }
          if (!finalUsername)
            finalUsername = `user${getRandomInt(1000, 99999)}`;
        }

        // استخدام مرجع خام بدون converter لضمان التوافق مع جميع إصدارات القواعد
        // القاعدة القديمة كانت تتطلب id == userId، والجديدة لا تتطلبه - الخام يعمل مع الاثنين
        const rawUserRef = doc(db, 'users', uid);
        const rawStatsRef = doc(db, 'users', uid, 'stats', 'stats');

        const userData = {
          bio: null,
          name: fallbackName,
          theme: null,
          accent: null,
          website: null,
          location: null,
          photoURL: fallbackPhoto,
          username: finalUsername,
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
            setDoc(rawUserRef, userData),
            setDoc(rawStatsRef, userStatsData)
          ]);

          const newSnap = await getDoc(doc(usersCollection, uid));
          const newUser = newSnap.data();
          if (newUser) setUser({ ...defaultUserData, ...newUser } as User);
          else setUser({ ...defaultUserData, username: finalUsername } as User);
        } catch (err) {
          console.error('create user doc failed', err);
          setError(err as Error);
          // اسمح بإعادة المحاولة عند إعادة تحميل الصفحة أو تسجيل دخول جديد
          processedUid.current = null;
        }
      } else {
        const userData = userSnapshot.data();
        setUser({ ...defaultUserData, ...userData } as User);
      }

      if (!cancelled) setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (cancelled) return;
      if (authUser) {
        if (processedUid.current === authUser.uid) return;
        void manageUser(authUser).catch((err) => {
          console.error('manageUser error', err);
          setError(err as Error);
          processedUid.current = null;
          setLoading(false);
        });
      } else {
        setUser(null);
        processedUid.current = null;
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    void registerWebPushToken(userId);
    const handleToken = (): void => void registerWebPushToken(userId);
    window.addEventListener('aite-fcm-token', handleToken);

    return () => window.removeEventListener('aite-fcm-token', handleToken);
  }, [user?.id]);

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
      // استخدم مرجع خام لتجنب مشاكل converter
      void updateDoc(doc(db, 'users', userId), {
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
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const { id } = user;

    const unsubscribeUser = onSnapshot(
      doc(usersCollection, id),
      (snap) => {
        if (snap.exists())
          setUser((prev) => ({ ...prev, ...snap.data() } as User));
      },
      (err) => {
        console.error('user snapshot error:', err);
      }
    );

    const unsubscribeNotifications = onSnapshot(
      query(notificationsCollection(id), where('read', '==', false)),
      (snapshot) => setUnreadNotifications(snapshot.size),
      (err) => {
        console.error('notifications count error:', err);
        setUnreadNotifications(0);
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeNotifications();
    };
  }, [user?.id]);

  const toArabicAuthError = (error: unknown): Error => {
    const code = (error as { code?: string })?.code ?? '';
    const message = (error as { message?: string })?.message ?? '';
    const map: Record<string, string> = {
      'auth/invalid-credential': 'اسم المستخدم أو كلمة المرور غير صحيحة',
      'auth/wrong-password': 'اسم المستخدم أو كلمة المرور غير صحيحة',
      'auth/user-not-found': 'لا يوجد حساب بهذا الاسم',
      'auth/too-many-requests': 'محاولات كثيرة — انتظر قليلًا ثم حاول مجددًا',
      'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
      'auth/email-already-in-use': 'اسم المستخدم مسجل مسبقًا',
      'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
      'auth/popup-closed-by-user': 'أُلغي تسجيل الدخول',
      'auth/invalid-email': 'اسم المستخدم غير صالح',
      'auth/operation-not-allowed': 'التسجيل غير مفعل حاليًا',
      'auth/unauthorized-domain': 'حدث خطأ مؤقت — حاول مجددًا لاحقًا',
      'permission-denied': 'تعذر حفظ البيانات — حاول مجددًا',
      'firestore/permission-denied': 'تعذر حفظ البيانات — حاول مجددًا'
    };

    // رسائل مخصصة لبعض الحالات
    if (message.includes('projectId') || message.includes('aite-76'))
      return new Error('حدث خطأ مؤقت — يرجى إعادة تحميل الصفحة');

    return new Error(
      map[code] ??
        (code
          ? `${map[code] ?? 'تعذر تسجيل الدخول'} (${code})`
          : 'تعذر تسجيل الدخول — حاول مرة أخرى')
    );
  };

  const signInWithUsername = async (
    username: string,
    password: string
  ): Promise<void> => {
    try {
      const cleaned = username.trim().replace(/\s+/g, '').toLowerCase();
      if (!cleaned || !password)
        throw new Error('يرجى إدخال اسم المستخدم وكلمة المرور');
      const email = usernameToInternalEmail(cleaned);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const arabic = toArabicAuthError(err);
      setError(arabic);
      throw arabic;
    }
  };

  const signUpWithUsername = async ({
    name,
    username,
    password
  }: SignUpData): Promise<void> => {
    try {
      const cleanedUsername = username.trim().replace(/\s+/g, '').toLowerCase();
      const cleanedName = name.trim();

      if (!cleanedName || !cleanedUsername || !password)
        throw new Error('يرجى ملء جميع الحقول');

      if (cleanedUsername.length < 3)
        throw new Error('اسم المستخدم قصير جدًا (3 أحرف على الأقل)');
      if (cleanedUsername.length > 15)
        throw new Error('اسم المستخدم طويل جدًا (15 حرفًا كحد أقصى)');
      if (!/^\w+$/i.test(cleanedUsername))
        throw new Error("اسم المستخدم يمكن أن يحتوي فقط على أحرف وأرقام و '_'");

      if (password.length < 6)
        throw new Error('كلمة المرور ضعيفة (6 أحرف على الأقل)');

      // تحقق من التوفر مع معالجة أخطاء الصلاحيات
      let isAvailable = true;
      try {
        isAvailable = await checkUsernameAvailability(cleanedUsername);
      } catch (err) {
        console.warn('checkUsernameAvailability failed, proceeding', err);
        // إذا فشل التحقق بسبب القواعد، نسمح بالمتابعة وسيكشف التكرار لاحقًا
        isAvailable = true;
      }

      if (!isAvailable) {
        const error = new Error('اسم المستخدم غير متاح');
        setError(error);
        throw error;
      }

      const email = usernameToInternalEmail(cleanedUsername);

      const { user: authUser } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      try {
        sessionStorage.setItem(
          `aite:pending-profile:${authUser.uid}`,
          JSON.stringify({ name: cleanedName, username: cleanedUsername })
        );
      } catch {
        // ignore
      }

      const defaultPhotoURL = '/assets/default-avatar.png';

      try {
        await updateProfile(authUser, {
          displayName: cleanedName,
          photoURL: defaultPhotoURL
        });
      } catch {
        // غير حرج
      }

      // إنشاء وثيقة المستخدم بمرجع خام لتجنب مشاكل converter
      const rawUserRef = doc(db, 'users', authUser.uid);
      const rawStatsRef = doc(db, 'users', authUser.uid, 'stats', 'stats');

      const userData = {
        bio: null,
        name: cleanedName,
        theme: null,
        accent: null,
        website: null,
        location: null,
        photoURL: defaultPhotoURL,
        username: cleanedUsername,
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

      try {
        await Promise.all([
          setDoc(rawUserRef, userData),
          setDoc(rawStatsRef, userStatsData)
        ]);
      } catch (err) {
        console.error('setDoc failed', err);
        // حتى لو فشل إنشاء الوثيقة، سيحاول manageUser إنشاءها مرة أخرى
        // لا نرمي خطأ هنا لأن حساب Auth تم إنشاؤه بنجاح
      }
    } catch (err) {
      const arabic =
        err instanceof Error && err.message.includes('اسم المستخدم')
          ? err
          : toArabicAuthError(err);
      setError(arabic);
      throw arabic;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (typeof window !== 'undefined')
        window.sessionStorage.setItem('aite:post-logout', '1');
      await signOutFirebase(auth);
    } catch (err) {
      setError(err as Error);
    }
  };

  const isAdmin = false;
  const randomSeed = useMemo(getRandomId, [user?.id]);

  const markStoryViewed = useCallback((storyUserId: string): void => {
    setUser((prevUser) => {
      if (!prevUser) return prevUser;
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
