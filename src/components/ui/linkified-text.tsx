const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/g;

type LinkifiedTextProps = {
  text: string;
  /** تنسيق الرابط نفسه — اضبطه حسب لون خلفية الحاوية */
  linkClassName?: string;
};

export function LinkifiedText({
  text,
  linkClassName
}: LinkifiedTextProps): JSX.Element {
  const parts = text.split(URL_PATTERN);

  return (
    <>
      {parts.map((part, index) => {
        if (!/^(https?:\/\/|www\.)/.test(part)) return part;
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a
            key={index}
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            onClick={(event) => event.stopPropagation()}
            className={
              linkClassName ??
              'break-all text-main-accent-text underline decoration-main-accent/60 underline-offset-2 transition hover:decoration-main-accent'
            }
          >
            {part}
          </a>
        );
      })}
    </>
  );
}
