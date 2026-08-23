import { useEffect } from 'react';

/**
 * تهيئة بيئة العرض للتطبيق الأصلي والويب:
 * - متغيّر --app-height لارتفاع شاشة حقيقي داخل WebView (بديل 100vh غير الدقيق)
 * - إضافة صنف native-app / standalone لتخصيص التنسيقات
 * - إضافة مناطق الأمان كمتغيّرات قابلة للاستخدام
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

    const ua = navigator.userAgent || '';

    const isNative =
      /\b(capacitor|cordova)\b/i.test(ua) ||
      'Capacitor' in window ||
      (window as Window & { cordova?: unknown }).cordova !== undefined;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (isNative) root.classList.add('native-app');
    if (isStandalone) root.classList.add('standalone-app');
    if (/android/i.test(ua)) root.classList.add('is-android');

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
