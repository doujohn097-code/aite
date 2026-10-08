#!/usr/bin/env node
/**
 * jose@4 (تبعية firebase-admin عبر jwks-rsa) تعلن شرط تصدير "workerd" يشير
 * إلى dist/browser — تتبّع OpenNext لا ينسخ ذلك المجلد فينسخ esbuild الفشل.
 * نسخة Node (CJS) تعمل بلا مشاكل على Workers مع nodejs_compat، لذا نحذف
 * شروط التشغيل البديلة من خريطة التصدير بعد التثبيت.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkgPath = join(process.cwd(), 'node_modules', 'jose', 'package.json');
if (!existsSync(pkgPath)) process.exit(0);

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (!pkg.version?.startsWith('4.')) process.exit(0);

const entry = pkg.exports?.['.'];
if (entry) {
  let changed = false;
  for (const key of ['workerd', 'worker', 'browser', 'bun', 'deno']) {
    if (key in entry) {
      delete entry[key];
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('[patch-jose] removed alternate runtime export conditions');
  }
}
