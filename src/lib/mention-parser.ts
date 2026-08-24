export const MAX_MENTIONS_PER_CONTENT = 10;

const MENTION_PATTERN = /(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,15})\b/g;

export function extractMentions(text: string): string[] {
  const usernames = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_PATTERN.lastIndex = 0;

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    usernames.add(match[2].toLowerCase());
    if (usernames.size >= MAX_MENTIONS_PER_CONTENT) break;
  }

  return Array.from(usernames);
}

export function isMentionToken(value: string): boolean {
  return /^@[a-zA-Z0-9_]{3,15}$/.test(value);
}

export type ActiveMention = {
  start: number;
  end: number;
  query: string;
};

export function getActiveMention(
  text: string,
  caret: number
): ActiveMention | null {
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && /[a-zA-Z0-9_]/.test(before.charAt(at - 1))) return null;
  const query = before.slice(at + 1);
  if (query.length > 15) return null;
  if (!/^[a-zA-Z0-9_]*$/.test(query)) return null;
  return { start: at, end: caret, query };
}

export function applyMention(
  text: string,
  caret: number,
  username: string
): { text: string; caret: number } {
  const safe = username.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(safe)) return { text, caret };
  const active = getActiveMention(text, caret);
  const insertion = `@${safe} `;
  if (!active) {
    const next = `${text.slice(0, caret)}${insertion}${text.slice(caret)}`;
    return { text: next, caret: caret + insertion.length };
  }
  const next = `${text.slice(0, active.start)}${insertion}${text.slice(
    active.end
  )}`;
  return { text: next, caret: active.start + insertion.length };
}
