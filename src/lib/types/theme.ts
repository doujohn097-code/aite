export type Theme =
  | 'light'
  | 'dim'
  | 'dark'
  | 'lilac'
  | 'ocean'
  | 'crimson'
  | 'violet'
  | 'emerald';

export type Accent = 'blue' | 'yellow' | 'pink' | 'purple' | 'orange' | 'green';

type ThemeMeta = {
  label: string;
  description: string;
  /** واجهة داكنة (نصوص فاتحة) */
  dark: boolean;
  /** خلفية صورة متحركة */
  wallpaper?: string;
  thumbnail?: string;
  /** لون التمييز الموصى به مع هذا المظهر */
  accent?: Accent;
  /** تدرّج المعاينة للمظاهر بدون صورة */
  preview: string;
};

export const themesMeta: Readonly<Record<Theme, ThemeMeta>> = {
  dark: {
    label: 'الافتراضي',
    description: 'أسود كامل',
    dark: true,
    preview: 'linear-gradient(135deg,#22262b 0%,#000000 100%)'
  },
  light: {
    label: 'فاتح',
    description: 'أبيض نقي',
    dark: false,
    preview: 'linear-gradient(135deg,#ffffff 0%,#e9eff3 100%)'
  },
  dim: {
    label: 'خافت',
    description: 'أزرق ليلي هادئ',
    dark: true,
    preview: 'linear-gradient(135deg,#1e2732 0%,#15202b 100%)'
  },
  lilac: {
    label: 'ليلكي سائل',
    description: 'لمعان بنفسجي فاتح',
    dark: false,
    wallpaper: '/assets/themes/lilac.webp',
    thumbnail: '/assets/themes/lilac-thumb.webp',
    accent: 'purple',
    preview: 'linear-gradient(135deg,#efe6ff 0%,#c9b6ec 100%)'
  },
  ocean: {
    label: 'أزرق سائل',
    description: 'موجات زرقاء لامعة',
    dark: true,
    wallpaper: '/assets/themes/ocean.webp',
    thumbnail: '/assets/themes/ocean-thumb.webp',
    accent: 'blue',
    preview: 'linear-gradient(135deg,#39627f 0%,#0a1626 100%)'
  },
  crimson: {
    label: 'عاصفة قرمزية',
    description: 'برق وردي في الغيوم',
    dark: true,
    wallpaper: '/assets/themes/crimson.webp',
    thumbnail: '/assets/themes/crimson-thumb.webp',
    accent: 'pink',
    preview: 'linear-gradient(135deg,#a3164a 0%,#1a0510 100%)'
  },
  violet: {
    label: 'بنفسجي سائل',
    description: 'حرير بنفسجي داكن',
    dark: true,
    wallpaper: '/assets/themes/violet.webp',
    thumbnail: '/assets/themes/violet-thumb.webp',
    accent: 'purple',
    preview: 'linear-gradient(135deg,#6d51d6 0%,#100a26 100%)'
  },
  emerald: {
    label: 'ماء زمردي',
    description: 'أوراق تحت الماء',
    dark: true,
    wallpaper: '/assets/themes/emerald.webp',
    thumbnail: '/assets/themes/emerald-thumb.webp',
    accent: 'green',
    preview: 'linear-gradient(135deg,#5c8a3a 0%,#06180f 100%)'
  }
};

export const themesList = Object.keys(themesMeta) as Theme[];

export const isTheme = (value: unknown): value is Theme =>
  typeof value === 'string' && value in themesMeta;

export const isDarkTheme = (theme: Theme): boolean => themesMeta[theme].dark;

export const getWallpaper = (theme: Theme): string | undefined =>
  themesMeta[theme].wallpaper;
