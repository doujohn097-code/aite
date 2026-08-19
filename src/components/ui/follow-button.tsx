import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { manageFollow } from '@lib/firebase/utils';
import { preventBubbling } from '@lib/utils';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { Button } from '@components/ui/button';

type FollowButtonProps = {
  userTargetId: string;
  userTargetUsername: string;
};

export function FollowButton({
  userTargetId,
  userTargetUsername
}: FollowButtonProps): JSX.Element | null {
  const { user } = useAuth();
  const { open, openModal, closeModal } = useModal();
  const [optimisticFollowing, setOptimisticFollowing] = useState<
    boolean | null
  >(null);

  const userId = user?.id;
  const userIsFollowed = !!user?.following?.includes(userTargetId ?? '');

  // Drop the override once the Firestore listener confirms the new state
  useEffect(() => {
    if (optimisticFollowing !== null && userIsFollowed === optimisticFollowing)
      setOptimisticFollowing(null);
  }, [userIsFollowed, optimisticFollowing]);

  if (!user || !userId) return null;

  if (userId === userTargetId) return null;

  const followingNow = optimisticFollowing ?? userIsFollowed;

  const handleFollow = (): void => {
    setOptimisticFollowing(true);
    void manageFollow('follow', userId, userTargetId).catch(() => {
      setOptimisticFollowing(null);
      toast.error('تعذرت المتابعة، حاول مجدداً');
    });
  };

  const handleUnfollow = (): void => {
    setOptimisticFollowing(false);
    closeModal();
    void manageFollow('unfollow', userId, userTargetId).catch(() => {
      setOptimisticFollowing(null);
      toast.error('تعذر إلغاء المتابعة، حاول مجدداً');
    });
  };

  return (
    <>
      <Modal
        modalClassName='flex flex-col gap-6 max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          title={`إلغاء متابعة @${userTargetUsername}؟`}
          description='لن تظهر منشوراتهم في الخط الزمني. يمكنك استعراض ملفهم الشخصي ما لم تكن المنشورات محمية.'
          mainBtnLabel='إلغاء المتابعة'
          mainBtnClassName='bg-accent-red text-white hover:bg-accent-red/90 focus-visible:bg-accent-red/90 active:bg-accent-red/80'
          action={handleUnfollow}
          closeModal={closeModal}
        />
      </Modal>
      {followingNow ? (
        <Button
          className='group dark-bg-tab min-w-[106px] self-start border border-light-line-reply px-4 py-1.5 
                     font-bold transition-all duration-200 hover:border-accent-red hover:bg-accent-red/10 
                     hover:text-accent-red dark:border-light-secondary'
          onClick={preventBubbling(openModal)}
        >
          <span className='group-hover:hidden'>يتابع</span>
          <span className='hidden group-hover:inline'>إلغاء المتابعة</span>
        </Button>
      ) : (
        <Button
          className='self-start bg-light-primary px-4 py-1.5 font-bold text-white transition-all duration-200 
                     hover:brightness-90 focus-visible:brightness-90 active:scale-95 active:brightness-75 
                     dark:bg-light-border dark:text-light-primary'
          onClick={preventBubbling(handleFollow)}
        >
          متابعة
        </Button>
      )}
    </>
  );
}
