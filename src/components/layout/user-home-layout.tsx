import { useRouter } from 'next/router';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@lib/context/auth-context';
import { useUser } from '@lib/context/user-context';
import { getOrCreateConversation } from '@lib/messages';
import { SEO } from '@components/common/seo';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';
import { UserHomeCover } from '@components/user/user-home-cover';
import { UserHomeAvatar } from '@components/user/user-home-avatar';
import { UserDetails } from '@components/user/user-details';
import { Loading } from '@components/ui/loading';
import { FollowButton } from '@components/ui/follow-button';
import { variants } from '@components/user/user-header';
import { UserEditProfile } from '@components/user/user-edit-profile';
import { UpdateUsername } from '@components/home/update-username';
import { UserShare } from '@components/user/user-share';
import type { LayoutProps } from './common-layout';

export function UserHomeLayout({ children }: LayoutProps): JSX.Element {
  const { user, isAdmin } = useAuth();
  const { user: userData, loading } = useUser();

  const {
    query: { id }
  } = useRouter();

  const coverData = userData?.coverPhotoURL
    ? { src: userData.coverPhotoURL, alt: userData.name }
    : null;

  const profileData = userData
    ? { src: userData.photoURL, alt: userData.name }
    : null;

  const { id: userId } = user ?? {};

  const isOwner = userData?.id === userId;
  const isFollowing = !!user?.following?.includes(userData?.id ?? '');

  const [messaging, setMessaging] = useState(false);
  const { push } = useRouter();

  const openConversation = async (): Promise<void> => {
    if (!user || !userData || messaging) return;
    setMessaging(true);
    try {
      const conversation = await getOrCreateConversation(user.id, userData.id);
      void push(`/messages/${conversation.id}`);
    } finally {
      setMessaging(false);
    }
  };

  return (
    <>
      {userData && (
        <SEO title={`${`${userData.name} (@${userData.username})`} / Aite`} />
      )}
      <motion.section {...variants} exit={undefined}>
        {loading ? (
          <Loading className='mt-5' />
        ) : !userData ? (
          <>
            <UserHomeCover />
            <div className='flex flex-col gap-8'>
              <div className='relative flex flex-col gap-3 px-4 py-3'>
                <UserHomeAvatar className='self-end' />
                <p className='text-xl font-bold'>@{id}</p>
              </div>
              <div className='p-8 text-center'>
                <p className='text-3xl font-bold'>هذا الحساب غير موجود</p>
                <p className='text-light-secondary dark:text-dark-secondary'>
                  جرب البحث عن حساب آخر.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <UserHomeCover coverData={coverData} />
            <div className='relative flex flex-col gap-3 px-4 py-3'>
              <div className='grid grid-cols-[auto,1fr] items-start gap-3'>
                <UserHomeAvatar
                  className='-mt-3 -translate-y-1/2 transform justify-self-start'
                  profileData={profileData}
                  user={userData}
                />
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  {isOwner ? (
                    <>
                      <UpdateUsername />
                      <UserEditProfile />
                    </>
                  ) : (
                    <>
                      {isFollowing && (
                        <Button
                          className='flex items-center gap-1.5 bg-green-500 px-4 py-1.5 font-bold text-white
                                     transition hover:bg-green-600 active:bg-green-600/80'
                          onClick={() => void openConversation()}
                          loading={messaging}
                        >
                          <HeroIcon
                            className='h-4 w-4'
                            iconName='PaperAirplaneIcon'
                          />
                          مراسلة
                        </Button>
                      )}
                      <UserShare username={userData.username} />
                      <FollowButton
                        userTargetId={userData.id}
                        userTargetUsername={userData.username}
                      />
                      {isAdmin && <UserEditProfile hide />}
                    </>
                  )}
                </div>
              </div>
              <UserDetails {...userData} />
            </div>
          </>
        )}
      </motion.section>
      {userData && <>{children}</>}
    </>
  );
}
