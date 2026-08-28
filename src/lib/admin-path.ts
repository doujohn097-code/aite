// مسار لوحة الإدارة مخفي عمدًا (security through obscurity) — لا يتم
// ربطه في أي مكان بالواجهة، ولا يُحفظ في استعادة آخر مسار على Android.
// غيّر القيمة هنا فقط عند تدوير المسار (يجب تحديث الملف أيضًا:
// src/pages/admin/salem/2030.tsx).
export const ADMIN_PATH = '/admin/salem/2030';

/** هل المسار الحالي يخص لوحة الإدارة؟ */
export function isAdminPath(path: string): boolean {
  return path === ADMIN_PATH || path.startsWith(`${ADMIN_PATH}/`);
}
