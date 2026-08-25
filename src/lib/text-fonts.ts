export type TextFontGroup = 'ar' | 'en';

export type TextFont = {
  id: string;
  label: string;
  css: string;
  group: TextFontGroup;
  sample: string;
};

export const DEFAULT_TEXT_FONT = 'aite';

export const TEXT_FONTS: readonly TextFont[] = [
  {
    id: 'aite',
    label: 'الافتراضي',
    css: '"IBM Plex Sans Arabic", sans-serif',
    group: 'ar',
    sample: 'مرحبا في Aite'
  },
  {
    id: 'cairo',
    label: 'القاهرة',
    css: '"Cairo", sans-serif',
    group: 'ar',
    sample: 'نص عربي واضح'
  },
  {
    id: 'tajawal',
    label: 'تجوّل',
    css: '"Tajawal", sans-serif',
    group: 'ar',
    sample: 'تجوّل بين الأفكار'
  },
  {
    id: 'almarai',
    label: 'المراعي',
    css: '"Almarai", sans-serif',
    group: 'ar',
    sample: 'حروف ناعمة'
  },
  {
    id: 'amiri',
    label: 'أميري',
    css: '"Amiri", serif',
    group: 'ar',
    sample: 'خط عربي أصيل'
  },
  {
    id: 'reem',
    label: 'ريم كوفي',
    css: '"Reem Kufi", sans-serif',
    group: 'ar',
    sample: 'كوفي حديث'
  },
  {
    id: 'lalezar',
    label: 'لاله زار',
    css: '"Lalezar", cursive',
    group: 'ar',
    sample: 'عنوان بارز'
  },
  {
    id: 'ruqaa',
    label: 'عارف رقعة',
    css: '"Aref Ruqaa", serif',
    group: 'ar',
    sample: 'رقعة أنيقة'
  },
  {
    id: 'elmessiri',
    label: 'المسيري',
    css: '"El Messiri", sans-serif',
    group: 'ar',
    sample: 'عناوين هادئة'
  },
  {
    id: 'changa',
    label: 'تشانغا',
    css: '"Changa", sans-serif',
    group: 'ar',
    sample: 'حروف عريضة'
  },
  {
    id: 'naskh',
    label: 'نسخ',
    css: '"Noto Naskh Arabic", serif',
    group: 'ar',
    sample: 'نسخ للقراءة'
  },
  {
    id: 'readex',
    label: 'ريدكس',
    css: '"Readex Pro", sans-serif',
    group: 'ar',
    sample: 'واجهة حديثة'
  },
  {
    id: 'mada',
    label: 'مدى',
    css: '"Mada", sans-serif',
    group: 'ar',
    sample: 'نص يومي سلس'
  },
  {
    id: 'lemonada',
    label: 'ليمونادة',
    css: '"Lemonada", cursive',
    group: 'ar',
    sample: 'لمسة مرحة'
  },
  {
    id: 'kufi',
    label: 'كوفي',
    css: '"Noto Kufi Arabic", sans-serif',
    group: 'ar',
    sample: 'كوفي هندسي'
  },
  {
    id: 'poppins',
    label: 'Poppins',
    css: '"Poppins", sans-serif',
    group: 'en',
    sample: 'Clean modern type'
  },
  {
    id: 'playfair',
    label: 'Playfair',
    css: '"Playfair Display", serif',
    group: 'en',
    sample: 'Editorial serif'
  },
  {
    id: 'bebas',
    label: 'Bebas Neue',
    css: '"Bebas Neue", sans-serif',
    group: 'en',
    sample: 'BOLD HEADLINE'
  },
  {
    id: 'pacifico',
    label: 'Pacifico',
    css: '"Pacifico", cursive',
    group: 'en',
    sample: 'Friendly script'
  },
  {
    id: 'lobster',
    label: 'Lobster',
    css: '"Lobster", cursive',
    group: 'en',
    sample: 'Display script'
  },
  {
    id: 'script',
    label: 'Great Vibes',
    css: '"Great Vibes", cursive',
    group: 'en',
    sample: 'Elegant writing'
  },
  {
    id: 'mono',
    label: 'Typewriter',
    css: '"Courier New", monospace',
    group: 'en',
    sample: 'typed notes'
  },
  {
    id: 'heavy',
    label: 'Impact',
    css: '"Arial Black", Impact, sans-serif',
    group: 'en',
    sample: 'STRONG TYPE'
  },
  {
    id: 'inter',
    label: 'Inter',
    css: '"Inter", sans-serif',
    group: 'en',
    sample: 'Product sans'
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    css: '"Merriweather", serif',
    group: 'en',
    sample: 'Readable serif'
  },
  {
    id: 'oswald',
    label: 'Oswald',
    css: '"Oswald", sans-serif',
    group: 'en',
    sample: 'CONDENSED TITLE'
  },
  {
    id: 'dancing',
    label: 'Dancing Script',
    css: '"Dancing Script", cursive',
    group: 'en',
    sample: 'Soft handwriting'
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    css: '"Montserrat", sans-serif',
    group: 'en',
    sample: 'Geometric sans'
  },
  {
    id: 'roboto',
    label: 'Roboto',
    css: '"Roboto", sans-serif',
    group: 'en',
    sample: 'Neutral body'
  }
];

export function fontCss(id?: string | null): string {
  return (
    TEXT_FONTS.find((font) => font.id === id)?.css ??
    TEXT_FONTS[0].css
  );
}

export function isTextFontId(id?: string | null): boolean {
  return !!id && TEXT_FONTS.some((font) => font.id === id);
}

export function fontsByGroup(group: TextFontGroup): TextFont[] {
  return TEXT_FONTS.filter((font) => font.group === group);
}

export function isLastOwnInStreak<T extends { senderId: string }>(
  messages: T[],
  index: number,
  userId?: string | null
): boolean {
  const message = messages[index];
  if (!userId || message?.senderId !== userId) return false;
  const next = messages[index + 1];
  return !next || next.senderId !== userId;
}
