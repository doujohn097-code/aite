import { useCallback, useState } from 'react';
import { applyMention, getActiveMention } from '@lib/mention-parser';
import type { ChangeEvent, RefObject } from 'react';

type MentionInput = HTMLTextAreaElement | HTMLInputElement;

export function useMentionAssist(
  value: string,
  onValue: (next: string) => void,
  inputRef: RefObject<MentionInput>
): {
  mentionQuery: string | null;
  onMentionChange: (event: ChangeEvent<MentionInput>) => void;
  insertMention: (username: string) => void;
  closeMentions: () => void;
} {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const onMentionChange = useCallback(
    (event: ChangeEvent<MentionInput>) => {
      const next = event.target.value;
      onValue(next);
      const caret = event.target.selectionStart ?? next.length;
      const active = getActiveMention(next, caret);
      setMentionQuery(active ? active.query : null);
    },
    [onValue]
  );

  const insertMention = useCallback(
    (username: string) => {
      const el = inputRef.current;
      const caret = el?.selectionStart ?? value.length;
      const next = applyMention(value, caret, username);
      onValue(next.text);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        el?.focus();
        try {
          el?.setSelectionRange(next.caret, next.caret);
        } catch {
          /* ignore */
        }
      });
    },
    [inputRef, onValue, value]
  );

  const closeMentions = useCallback((): void => setMentionQuery(null), []);

  return { mentionQuery, onMentionChange, insertMention, closeMentions };
}
