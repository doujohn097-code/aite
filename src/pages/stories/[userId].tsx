import { useRouter } from 'next/router';
import { StoryViewer } from '@components/stories/story-viewer';
import { ProtectedLayout } from '@components/layout/common-layout';
import type { ReactElement, ReactNode } from 'react';

export default function StoriesPage(): JSX.Element {
  const {
    query: { userId }
  } = useRouter();

  const targetUserId = Array.isArray(userId) ? userId[0] : userId;

  if (!targetUserId) return <></>;

  return <StoryViewer userId={targetUserId} />;
}

StoriesPage.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>{page}</ProtectedLayout>
);
