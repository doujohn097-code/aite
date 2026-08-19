import cn from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { StatsEmpty } from '@components/tweet/stats-empty';
import { Loading } from '@components/ui/loading';
import { variants } from '@components/user/user-header';
import { UserCard } from './user-card';
import type { User } from '@lib/types/user';
import type { StatsType } from '@components/view/view-tweet-stats';
import type { StatsEmptyProps } from '@components/tweet/stats-empty';

type FollowType = 'following' | 'followers';

type CombinedTypes = StatsType | FollowType;

type UserCardsProps = {
  data: User[] | null;
  type: CombinedTypes;
  follow?: boolean;
  loading: boolean;
};

type NoStatsData = Record<CombinedTypes, StatsEmptyProps>;

const allNoStatsData: Readonly<NoStatsData> = {
  retweets: {
    title: 'انشر المنشورات التي تعجبك',
    imageData: { src: '/assets/no-retweets.png', alt: 'لا توجد إعادات نشر' },
    description:
      'شارك منشور الآخرين في خطك الزمني بإعادة نشرها. عندما تفعل، ستظهر هنا.'
  },
  likes: {
    title: 'لا توجد إعجابات بعد',
    imageData: { src: '/assets/no-likes.png', alt: 'لا توجد إعجابات' },
    description: 'عندما تعجب بمنشور، سيظهر هنا.'
  },
  following: {
    title: 'كن على اطلاع',
    description:
      'متابعة الحسابات طريقة سهلة لتنظيم خطك الزمني ومعرفة ما يحدث حول المواضيع والأشخاص المهمين لك.'
  },
  followers: {
    title: 'تبحث عن متابعين؟',
    imageData: { src: '/assets/no-followers.png', alt: 'لا يوجد متابعون' },
    description:
      'عندما يتابعك أحدهم، سيظهر هنا. النشر والتفاعل مع الآخرين يساعدك على زيادة المتابعين.'
  }
};

export function UserCards({
  data,
  type,
  follow,
  loading
}: UserCardsProps): JSX.Element {
  const noStatsData = allNoStatsData[type];
  const modal = ['retweets', 'likes'].includes(type);

  return (
    <section
      className={cn(
        modal && 'h-full overflow-y-auto [&>div:first-child>a]:mt-[52px]',
        loading && 'flex items-center justify-center'
      )}
    >
      {loading ? (
        <Loading className={modal ? 'mt-[52px]' : 'mt-5'} />
      ) : (
        <AnimatePresence mode='popLayout'>
          {data?.length ? (
            data.map((userData) => (
              <motion.div layout='position' key={userData.id} {...variants}>
                <UserCard {...userData} follow={follow} modal={modal} />
              </motion.div>
            ))
          ) : (
            <StatsEmpty {...noStatsData} modal={modal} />
          )}
        </AnimatePresence>
      )}
    </section>
  );
}
