import cn from 'clsx';
import type { ReactNode } from 'react';

type MainContainerProps = {
  children: ReactNode;
  className?: string;
};

export function MainContainer({
  children,
  className
}: MainContainerProps): JSX.Element {
  return (
    <main
      className={cn(
        `theme-surface hover-animation mx-auto flex min-h-app w-full max-w-xl flex-col border-x-0
         border-light-border pb-16 dark:border-dark-border xs:border-x xs:pb-0`,
        className
      )}
    >
      {children}
    </main>
  );
}
