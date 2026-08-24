import Link from 'next/link';
import { isMentionToken } from '@lib/mention-parser';
import { safeHttpUrl } from '@lib/utils';

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

    // لا نحوّل @ داخل بريد إلكتروني أو اسم مركّب إلى إشارة.
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

export function LinkifiedText({
  text,
  linkClassName
}: LinkifiedTextProps): JSX.Element {
  const classes =
    linkClassName ??
    'break-all text-main-accent-text underline decoration-main-accent/60 underline-offset-2 transition hover:decoration-main-accent';

  return (
    <>
      {tokenize(text).map((part, index) => {
        if (part.kind === 'text') return part.value;
        if (part.kind === 'mention') {
          const username = part.value.slice(1).toLowerCase();
          return (
            <Link href={`/user/${encodeURIComponent(username)}`} key={index}>
              <a
                className={classes}
                onClick={(event) => event.stopPropagation()}
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
            onClick={(event) => event.stopPropagation()}
            className={classes}
          >
            {part.value}
          </a>
        );
      })}
    </>
  );
}
