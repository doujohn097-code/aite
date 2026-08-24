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
