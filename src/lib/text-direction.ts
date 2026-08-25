export type TextDir = 'rtl' | 'ltr';

const RTL_CHAR =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const LTR_CHAR = /[A-Za-z\u00C0-\u024F]/;

function stripWeakPrefixes(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/@[a-zA-Z0-9_]{1,30}/g, ' ')
    .replace(/#[\w\u0600-\u06FF]+/g, ' ');
}

export function firstStrongDir(text: string): TextDir | null {
  if (!text) return null;
  for (const char of stripWeakPrefixes(text)) {
    if (RTL_CHAR.test(char)) return 'rtl';
    if (LTR_CHAR.test(char)) return 'ltr';
  }
  return null;
}

export function textDir(text: string, fallback: TextDir = 'rtl'): TextDir {
  return firstStrongDir(text) ?? fallback;
}

export function userTextDirAttr(text?: string | null): 'auto' | TextDir {
  if (!text || !text.trim()) return 'auto';
  return firstStrongDir(text) ?? 'auto';
}
