import cn from 'clsx';

/** يحوّل الإيموجي إلى مسار صورة Twemoji (SVG) — توحيد شكل الإيموجي
 *  على كل الأجهزة مثل إنستغرام بدل الاعتماد على خط النظام. */
function toCodePoint(emoji: string): string {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0)?.toString(16))
    .filter((code) => code && code !== 'fe0f')
    .join('-');
}

type TwemojiProps = {
  emoji: string;
  className?: string;
};

export function Twemoji({ emoji, className }: TwemojiProps): JSX.Element {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${toCodePoint(
        emoji
      )}.png`}
      alt={emoji}
      draggable={false}
      loading='lazy'
      className={cn(
        'inline-block h-[1.2em] w-[1.2em] select-none align-[-0.15em]',
        className
      )}
    />
  );
}
