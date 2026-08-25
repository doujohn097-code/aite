import cn from 'clsx';
import { userTextDirAttr } from '@lib/text-direction';
import type { ElementType, ReactNode } from 'react';

type UserTextProps = {
  text?: string | null;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
};

export function UserText({
  text,
  as: Tag = 'p',
  className,
  children
}: UserTextProps): JSX.Element {
  return (
    <Tag dir={userTextDirAttr(text)} className={cn('user-text', className)}>
      {children ?? text}
    </Tag>
  );
}
