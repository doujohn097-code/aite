/**
 * يحوّل الخاصية الحديثة `inset` (Chrome 87+) إلى top/right/bottom/left قبلها.
 * Tailwind يولّد `inset: 0px` لأصناف مثل inset-0، وويب فيو أندرويد/هواوي
 * الأقدم تتجاهلها فتفقد الطبقات المطلقة مواضعها وتتراكب العناصر أو تُدفع.
 * المتصفحات الحديثة تقرأ `inset` بعدها كالمعتاد، فلا تغيير في مظهرها.
 */
const { list } = require('postcss');

const DONE = Symbol('inset-fallback');

function expand(value) {
  const parts = list.space(value);
  const [top, right = top, bottom = top, left = right] = parts;
  return { top, right, bottom, left };
}

module.exports = () => ({
  postcssPlugin: 'inset-fallback',
  Declaration: {
    inset(decl) {
      if (decl[DONE]) return;
      decl[DONE] = true;
      const sides = expand(decl.value);
      for (const prop of ['top', 'right', 'bottom', 'left'])
        decl.cloneBefore({ prop, value: sides[prop] });
    }
  }
});

module.exports.postcss = true;
