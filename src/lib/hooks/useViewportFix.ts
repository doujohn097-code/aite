import { useEffect } from 'react';

/**
 * تهيئة بيئة العرض على الجوال والويب:
 * - متغيّر --app-height لارتفاع شاشة حقيقي (بديل 100vh غير الدقيق على الجوال)
 * - إضافة صنف standalone-app عند تثبيت التطبيق كـ PWA
 */
export function useViewportFix(): void {
  useEffect(() => {
    const root = document.documentElement;

    const setHeight = (): void => {
      // ارتفاع نافذة العرض الحقيقي (يتجاهل شريط المتصفح المتغيّر)
      const height = window.innerHeight;

      if (height) root.style.setProperty('--app-height', `${height}px`);

      // ارتفاع المنطقة المرئية (يصغر عند فتح لوحة المفاتيح)
      const visual = window.visualViewport?.height;

      if (visual) root.style.setProperty('--visual-height', `${visual}px`);
    };

    setHeight();

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (isStandalone) root.classList.add('standalone-app');

    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    window.visualViewport?.addEventListener('resize', setHeight);

    return () => {
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
      window.visualViewport?.removeEventListener('resize', setHeight);
    };
  }, []);
}
