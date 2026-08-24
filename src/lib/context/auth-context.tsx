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
import {
  internalEmailToUsername,
  isPlaceholderProfileName,
  isPlaceholderUsername,
  usernameToInternalEmail
} from '@lib/utils';
import { getSavedAccounts } from '@lib/accounts';
import { registerWebPushToken } from '@lib/native-bridge';
import { tx } from '@lib/i18n/tx';
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

type PendingSignUpProfile = {
  uid?: string;
  email?: string;
  name: string;
  username: string;
  createdAt?: number;
};

const PENDING_SIGN_UP_KEY = 'aite:pending-sign-up';
const PENDING_SIGN_UP_MAX_AGE_MS = 10 * 60 * 1000;

function readPendingProfile(key: string): PendingSignUpProfile | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PendingSignUpProfile>;
    if (typeof data.name !== 'string' || typeof data.username !== 'string')
      return null;
    return {
      uid: typeof data.uid === 'string' ? data.uid : undefined,
      email: typeof data.email === 'string' ? data.email : undefined,
      name: data.name.trim(),
      username: data.username.trim().toLowerCase(),
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : undefined
    };
  } catch {
    return null;
  }
}

function pendingMatchesUser(
  profile: PendingSignUpProfile | null,
  authUser: AuthUser
): profile is PendingSignUpProfile {
  if (!profile?.name || !profile.username) return false;
  if (profile.uid && profile.uid !== authUser.uid) return false;
  if (profile.email && profile.email !== authUser.email) return false;
  if (
    profile.createdAt &&
    Date.now() - profile.createdAt > PENDING_SIGN_UP_MAX_AGE_MS
  )
    return false;
  return true;
}

export function AuthContextProvider({
  children
}: AuthContextProviderProps): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const processedUid = useRef<string | null>(null);
  const pendingSignUpRef = useRef<PendingSignUpProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    const manageUser = async (authUser: AuthUser): Promise<void> => {
      const { uid, displayName, photoURL } = authUser;

      if (!uid) return;
      if (processedUid.current === uid) return;

      setLoading(true);
      processedUid.current = uid;

      // Firebase يطلق onAuthStateChanged فور إنشاء حساب Auth، وقد يصل قبل
      // updateProfile وكتابة Firestore. نقرأ البيانات المعلّقة من الذاكرة
      // والجلسة حتى لا يُنشأ الملف باسم «مستخدم» واسم عشوائي.
      const legacyPending = readPendingProfile(`aite:pending-profile:${uid}`);
      const storedPending = readPendingProfile(PENDING_SIGN_UP_KEY);
      const pendingData = [
        pendingSignUpRef.current,
        legacyPending,
        storedPending
      ].find((profile) => pendingMatchesUser(profile, authUser));

      const decodedUsername = internalEmailToUsername(authUser.email);
      const savedAccounts = getSavedAccounts();
      const savedAccount = savedAccounts.find(
        (account) =>
          account.username === (pendingData?.username ?? decodedUsername) ||
          usernameToInternalEmail(account.username).toLowerCase() ===
            authUser.email?.toLowerCase()
      );
      const recoveredUsername =
        pendingData?.username ?? decodedUsername ?? savedAccount?.username;
      const authName = displayName?.trim() ?? '';
      const savedName = savedAccount?.name?.trim() ?? '';
      const fallbackName =
        pendingData?.name ||
        (!isPlaceholderProfileName(authName) ? authName : '') ||
        (!isPlaceholderProfileName(savedName) ? savedName : '') ||
        recoveredUsername ||
        '';
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
        // البريد الداخلي مشتق أصلًا من اسم المستخدم وفريد داخل Firebase Auth،
        // لذلك هو المصدر الأوثق لاستعادة الاسم عند فقدان كتابة Firestore.
        let finalUsername = recoveredUsername ?? '';

        if (!finalUsername) {
          // توليد اسم مستخدم عشوائي متاح
          let tries = 0;
          while (tries < 15) {
            const normalizeName =
              fallbackName
                .replace(/\s/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '')
                .slice(0, 8) || 'user';
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
            setDoc(rawUserRef, userData, { merge: true }),
            setDoc(rawStatsRef, userStatsData, { merge: true })
          ]);

          const newSnap = await getDoc(doc(usersCollection, uid));
          const newUser = newSnap.data();
          if (newUser) setUser({ ...defaultUserData, ...newUser } as User);
          else setUser({ ...defaultUserData, username: finalUsername } as User);

          try {
            sessionStorage.removeItem(`aite:pending-profile:${uid}`);
            sessionStorage.removeItem(PENDING_SIGN_UP_KEY);
          } catch {
            // التخزين تحسين إضافي فقط
          }
          if (pendingMatchesUser(pendingSignUpRef.current, authUser))
            pendingSignUpRef.current = null;
        } catch (err) {
          console.error('create user doc failed', err);
          setError(err as Error);
          // اسمح بإعادة المحاولة عند إعادة تحميل الصفحة أو تسجيل دخول جديد
          processedUid.current = null;
        }
      } else {
        const userData = userSnapshot.data();
        const repairs: { name?: string; username?: string } = {};

        // إصلاح الحسابات التي تأثرت بالسباق في الإصدارات السابقة. لا نغيّر
        // اسمًا حقيقيًا اختاره المستخدم؛ نصلح القيم الافتراضية المعروفة فقط.
        if (
          isPlaceholderProfileName(userData.name) &&
          !isPlaceholderProfileName(fallbackName)
        )
          repairs.name = fallbackName;

        if (
          recoveredUsername &&
          isPlaceholderUsername(userData.username) &&
          recoveredUsername !== userData.username
        )
          repairs.username = recoveredUsername;

        if (Object.keys(repairs).length) {
          await updateDoc(doc(db, 'users', uid), {
            ...repairs,
            updatedAt: serverTimestamp()
          }).catch(() => undefined);
          if (repairs.name && repairs.name !== authName)
            await updateProfile(authUser, { displayName: repairs.name }).catch(
              () => undefined
            );
        }

        setUser({ ...defaultUserData, ...userData, ...repairs } as User);

        try {
          sessionStorage.removeItem(`aite:pending-profile:${uid}`);
          sessionStorage.removeItem(PENDING_SIGN_UP_KEY);
        } catch {
          // ignore
        }
        if (pendingMatchesUser(pendingSignUpRef.current, authUser))
          pendingSignUpRef.current = null;
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
      'auth/invalid-credential': tx('err.wrongUserPass'),
      'auth/wrong-password': tx('err.wrongUserPass'),
      'auth/user-not-found': tx('err.noAccount'),
      'auth/too-many-requests': tx('settings.tooMany'),
      'auth/network-request-failed': tx('err.network'),
      'auth/email-already-in-use': tx('err.userExists'),
      'auth/weak-password': tx('auth.passWeak'),
      'auth/popup-closed-by-user': tx('common.cancel'),
      'auth/invalid-email': tx('auth.userChars'),
      'auth/operation-not-allowed': tx('err.temp'),
      'auth/unauthorized-domain': tx('err.temp'),
      'permission-denied': tx('err.saveData'),
      'firestore/permission-denied': tx('err.saveData')
    };

    if (message.includes('projectId') || message.includes('aite-76'))
      return new Error(tx('err.reloadPage'));

    return new Error(
      map[code] ??
        (code
          ? `${map[code] ?? tx('err.loginFail')} (${code})`
          : tx('err.loginFail'))
    );
  };

  const signInWithUsername = async (
    username: string,
    password: string
  ): Promise<void> => {
    try {
      const cleaned = username.trim().replace(/\s+/g, '').toLowerCase();
      if (!cleaned || !password)
        throw new Error(tx('auth.needCreds'));
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
        throw new Error(tx('auth.fillAll'));

      if (cleanedUsername.length < 3)
        throw new Error(tx('auth.userShort'));
      if (cleanedUsername.length > 15)
        throw new Error(tx('auth.userLong'));
      if (!/^\w+$/i.test(cleanedUsername))
        throw new Error(tx('auth.userChars'));

      if (password.length < 6)
        throw new Error(tx('auth.passWeak'));

      try {
        const last = Number(window.localStorage.getItem('aite:last-signup') ?? '0');
        if (last && Date.now() - last < 45_000)
          throw new Error(tx('err.waitSignup'));
      } catch (error) {
        if (error instanceof Error && error.message === tx('err.waitSignup')) throw error;
      }

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
        const error = new Error(tx('err.userUnavailable'));
        setError(error);
        throw error;
      }

      const email = usernameToInternalEmail(cleanedUsername);
      const pendingProfile: PendingSignUpProfile = {
        email,
        name: cleanedName,
        username: cleanedUsername,
        createdAt: Date.now()
      };

      // يجب حفظ بيانات الملف قبل إنشاء حساب Auth: مستمع المصادقة قد يعمل
      // قبل أن يعود createUserWithEmailAndPassword إلى هذا السطر.
      pendingSignUpRef.current = pendingProfile;
      try {
        sessionStorage.setItem(
          PENDING_SIGN_UP_KEY,
          JSON.stringify(pendingProfile)
        );
      } catch {
        // الذاكرة الداخلية تكفي في الجلسة الحالية
      }

      const { user: authUser } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      try {
        window.localStorage.setItem('aite:last-signup', String(Date.now()));
      } catch {
        // ignore
      }
      pendingProfile.uid = authUser.uid;

      try {
        sessionStorage.setItem(
          PENDING_SIGN_UP_KEY,
          JSON.stringify(pendingProfile)
        );
        sessionStorage.setItem(
          `aite:pending-profile:${authUser.uid}`,
          JSON.stringify(pendingProfile)
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
          setDoc(rawUserRef, userData, { merge: true }),
          setDoc(rawStatsRef, userStatsData, { merge: true })
        ]);

        try {
          sessionStorage.removeItem(PENDING_SIGN_UP_KEY);
          sessionStorage.removeItem(`aite:pending-profile:${authUser.uid}`);
        } catch {
          // ignore
        }
        if (pendingMatchesUser(pendingSignUpRef.current, authUser))
          pendingSignUpRef.current = null;
      } catch (err) {
        console.error('setDoc failed', err);
        // نبقي البيانات المعلّقة ليعيد manageUser المحاولة دون اسم افتراضي.
        processedUid.current = null;
      }
    } catch (err) {
      pendingSignUpRef.current = null;
      try {
        sessionStorage.removeItem(PENDING_SIGN_UP_KEY);
      } catch {
        // ignore
      }

      const arabic =
        err instanceof Error &&
        (err.message === tx('auth.userShort') ||
          err.message === tx('auth.userLong') ||
          err.message === tx('auth.userChars') ||
          err.message === tx('err.userUnavailable') ||
          err.message === tx('auth.fillAll') ||
          err.message === tx('err.waitSignup'))
          ? err
          : toArabicAuthError(err);
      setError(arabic);
      throw arabic;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('aite:post-logout', '1');
        window.localStorage.removeItem('aite:native-last-route');
      }
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
