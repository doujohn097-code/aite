export type Theme = 'light' | 'dim' | 'dark' | 'rose' | 'violet' | 'emerald';
export type Accent = 'blue' | 'yellow' | 'pink' | 'purple' | 'orange' | 'green';

export const GLASS_THEMES: Readonly<Theme[]> = ['rose', 'violet', 'emerald'];

export const DARK_LIKE_THEMES: Readonly<Theme[]> = [
  'dark',
  'dim',
  'rose',
  'violet',
  'emerald'
];

export const THEME_ACCENTS: Readonly<Partial<Record<Theme, Accent>>> = {
  rose: 'pink',
  violet: 'purple',
  emerald: 'green'
};
