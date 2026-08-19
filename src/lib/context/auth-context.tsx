import { useState, useEffect, useContext, createContext, useMemo, useRef, useCallback } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
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
  notificationsCollection,
  conversationsCollection
} from '@lib/firebase/collections';
import { getRandomId, getRandomInt } from '@lib/random';
import { checkUsernameAvailability } from '@lib/firebase/utils';
import { usernameToInternalEmail } from '@lib/utils';
import { saveAccount } from '@lib/accounts';
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
  unreadMessages: number;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const processedUid = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const authResolved = { current: false };
    const redirectResolved = { current: false };

    const finishInitialCheck = (): void => {
      if (cancelled) return;
      if (
        authResolved.current &&
        redirectResolved.current &&
        !processedUid.current
      ) {
        setLoading(false);
      }
    };

    const manageUser = async (authUser: AuthUser): Promise<void> => {
      const { uid, displayName, photoURL } = authUser;

      const isGoogleAccount = authUser.providerData?.some(
        ({ providerId }) => providerId === 'google.com'
      );

      const persistGoogleAccount = (
        username: string,
        name: string,
        photo: string | null
      ): void => {
        if (isGoogleAccount)
          saveAccount({ username, password: '', name, photoURL: photo, provider: 'google' });
      };

      if (!uid || processedUid.current === uid) return;

      setLoading(true);
      processedUid.current = uid;

      const fallbackName = displayName ?? 'مستخدم';
      const fallbackPhoto = photoURL ?? '/assets/default-avatar.png';

      const userSnapshot = await getDoc(doc(usersCollection, uid));

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
        let available = false;
        let randomUsername = '';

        while (!available) {
          const normalizeName = fallbackName.replace(/\s/g, '').toLowerCase();
          const randomInt = getRandomInt(1, 10_000);

          randomUsername = `${normalizeName}${randomInt}`;

          const isUsernameAvailable = await checkUsernameAvailability(
            randomUsername
          );

          if (isUsernameAvailable) available = true;
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
          persistGoogleAccount(randomUsername, fallbackName, fallbackPhoto);
        } catch (error) {
          setError(error as Error);
        }
      } else {
        const userData = userSnapshot.data();
        setUser({ ...defaultUserData, ...userData } as User);
        persistGoogleAccount(
          (userData?.username as string) ?? '',
          (userData?.name as string) ?? fallbackName,
          (userData?.photoURL as string) ?? fallbackPhoto
        );
      }

      setLoading(false);
    };

    const handleUserAuth = (authUser: AuthUser | null): void => {
      if (authUser) {
        if (processedUid.current === authUser.uid) return;
        void manageUser(authUser).catch((error) => {
          setError(error as Error);
          setLoading(false);
        });
      } else {
        setUser(null);
        finishInitialCheck();
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      authResolved.current = true;
      handleUserAuth(authUser);
    });

    getRedirectResult(auth)
      .then((result) => {
        redirectResolved.current = true;
        if (result?.user) handleUserAuth(result.user);
        else finishInitialCheck();
      })
      .catch((error) => {
        redirectResolved.current = true;
        setError(error as Error);
        finishInitialCheck();
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const { id } = user;

    const unsubscribeUser = onSnapshot(
      doc(usersCollection, id),
      (doc) => {
        setUser((prevUser) => ({ ...prevUser, ...(doc.data() as User) }) as User);
      },
      (error) => {
        console.error('user snapshot error:', error);
      }
    );

    const unsubscribeNotifications = onSnapshot(
      query(notificationsCollection(id), where('read', '==', false)),
      (snapshot) =>
        setUnreadNotifications(
          snapshot.docs.filter(
            (docSnapshot) => docSnapshot.data().type !== 'message'
          ).length
        ),
      (error) => {
        console.error('notifications count error:', error);
        setUnreadNotifications(0);
      }
    );

    const unsubscribeConversations = onSnapshot(
      query(conversationsCollection, where('participants', 'array-contains', id)),
      (snapshot) => {
        const count = snapshot.docs.reduce((acc, docSnapshot) => {
          const data = docSnapshot.data({ serverTimestamps: 'estimate' });
          return acc + (data.unreadCount?.[id] ?? 0);
        }, 0);
        setUnreadMessages(count);
      },
      (error) => {
        console.error('conversations count error:', error);
        setUnreadMessages(0);
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeNotifications();
      unsubscribeConversations();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signInWithGoogle = async (): Promise<void> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      const { code } = error as { code?: string };
      if (code === 'auth/popup-blocked') {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          setError(redirectError as Error);
        }
      } else {
        setError(error as Error);
      }
    }
  };

  const signInWithUsername = async (
    username: string,
    password: string
  ): Promise<void> => {
    try {
      const email = usernameToInternalEmail(username);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setError(error as Error);
      throw error;
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
    setUser((prevUser) =>
      prevUser
        ? {
            ...prevUser,
            storyViews: {
              ...(prevUser.storyViews ?? {}),
              [storyUserId]: Timestamp.now()
            }
          }
        : prevUser
    );
  }, []);

  const value: AuthContext = {
    user,
    error,
    loading,
    isAdmin,
    randomSeed,
    unreadNotifications,
    unreadMessages,
    signOut,
    signInWithGoogle,
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
