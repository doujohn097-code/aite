import Link from 'next/link';
import cn from 'clsx';
import { isMentionToken } from '@lib/mention-parser';
import { safeHttpUrl } from '@lib/utils';
import { HeroIcon } from './hero-icon';

const TOKEN_PATTERN =
  /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|@[a-zA-Z0-9_]{3,15}\b)/g;

type LinkifiedTextProps = {
  text: string;
  /** تنسيق الرابط نفسه — اضبطه حسب لون خلفية الحاوية */
  linkClassName?: string;
};

type TextPart = { value: string; kind: 'text' | 'url' | 'mention' };

function tokenize(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    const value = match[0];
    const isMention = isMentionToken(value);
    const previous = match.index > 0 ? text[match.index - 1] : '';

    if (isMention && /[a-zA-Z0-9_@]/.test(previous)) continue;

    if (match.index > cursor)
      parts.push({ value: text.slice(cursor, match.index), kind: 'text' });
    parts.push({
      value,
      kind: isMention ? 'mention' : 'url'
    });
    cursor = match.index + value.length;
  }

  if (cursor < text.length)
    parts.push({ value: text.slice(cursor), kind: 'text' });
  return parts;
}

function linkLabel(href: string, raw: string): string {
  try {
    const host = new URL(href).hostname.replace(/^www\./, '');
    return host || raw;
  } catch {
    return raw;
  }
}

export function LinkifiedText({
  text,
  linkClassName
}: LinkifiedTextProps): JSX.Element {
  const mentionClass =
    linkClassName ??
    'font-bold text-main-accent-text transition hover:underline';

  return (
    <>
      {tokenize(text).map((part, index) => {
        if (part.kind === 'text') return part.value;
        if (part.kind === 'mention') {
          const username = part.value.slice(1).toLowerCase();
          return (
            <Link href={`/user/${encodeURIComponent(username)}`} key={index}>
              <a
                dir='ltr'
                className={cn(mentionClass, 'user-text-ltr inline')}
                onClick={(event): void => {
                  event.stopPropagation();
                }}
              >
                {part.value}
              </a>
            </Link>
          );
        }

        const href = safeHttpUrl(part.value);
        if (!href) return part.value;
        return (
          <a
            key={index}
            href={href}
            target='_blank'
            rel='noopener noreferrer nofollow'
            referrerPolicy='no-referrer'
            onClick={(event): void => {
              event.stopPropagation();
            }}
            dir='ltr'
            className={
              linkClassName ??
              'user-text-ltr bg-main-accent/12 mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 align-middle text-[13px] font-semibold text-main-accent-text ring-1 ring-main-accent/20 transition hover:bg-main-accent/20'
            }
          >
            <HeroIcon className='h-3.5 w-3.5 shrink-0' iconName='LinkIcon' />
            <span className='truncate'>{linkLabel(href, part.value)}</span>
          </a>
        );
      })}
    </>
  );
}
