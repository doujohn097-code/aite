#!/usr/bin/env node
/**
 * fetch الأصلية على Cloudflare Workers بدل node-fetch.
 *
 * مكتبات Google (google-gax و gaxios) تختار node-fetch دائماً خارج المتصفح.
 * على Workers يمر node-fetch عبر محاكاة node:http في workerd، وهذا يفشل:
 * - node-fetch@2 (google-gax ← استعلامات Firestore): ترويسات المصفوفات تُسقط
 *   الطلب ("Cannot read properties of null (reading 'has')").
 * - node-fetch@3 (gaxios@7 ← google-auth-library ← توكن firebase-admin): يطلب
 *   gzip ولا يفك ضغط الرد، فيفشل جلب توكن OAuth وكل عمليات Firebase Auth
 *   الإدارية (getUser، تغيير كلمة السر، حذف الحساب...).
 *
 * الحل: على Workers فقط نستخدم fetch الأصلية (وفي google-gax نحوّل جسم
 * الاستجابة Web ReadableStream إلى Readable الخاص بـ Node قبل stream.pipeline).
 * سلوك Node العادي (التطوير المحلي/الاختبارات) يبقى كما هو.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';

const MARKER = '/* [workers-native-fetch] */';

const FETCH_ORIGINAL = `    const fetch = (0, featureDetection_1.hasWindowFetch)()
        ? window.fetch
        : node_fetch_1.default;`;
const FETCH_PATCHED = `    ${MARKER}
    const isCloudflareWorkers = typeof navigator !== 'undefined' &&
        navigator.userAgent === 'Cloudflare-Workers' &&
        typeof globalThis.fetch === 'function';
    const fetch = isCloudflareWorkers
        ? globalThis.fetch.bind(globalThis)
        : (0, featureDetection_1.hasWindowFetch)()
            ? window.fetch
            : node_fetch_1.default;`;

const PIPE_ORIGINAL = `(0, stream_1.pipeline)(response.body, streamArrayParser, (err) => {`;
const PIPE_PATCHED = `(0, stream_1.pipeline)(response.body &&
                        typeof response.body.getReader === 'function' &&
                        typeof stream_1.Readable.fromWeb === 'function'
                        ? stream_1.Readable.fromWeb(response.body)
                        : response.body, streamArrayParser, (err) => {`;

function findStubs(nodeModules, out) {
  if (!existsSync(nodeModules)) return;
  for (const name of readdirSync(nodeModules)) {
    if (name.startsWith('.')) continue;
    const full = join(nodeModules, name);
    if (name.startsWith('@')) {
      if (statSync(full).isDirectory()) findStubs(full, out);
      continue;
    }
    if (name === 'google-gax') {
      const stub = join(full, 'build', 'src', 'fallbackServiceStub.js');
      if (existsSync(stub)) out.push(stub);
    }
    findStubs(join(full, 'node_modules'), out);
  }
}

const stubs = [];
findStubs(join(process.cwd(), 'node_modules'), stubs);

let patched = 0;
for (const file of stubs) {
  const src = readFileSync(file, 'utf8');
  if (src.includes(MARKER)) continue;
  if (!src.includes(FETCH_ORIGINAL) || !src.includes(PIPE_ORIGINAL)) {
    console.warn(`[patch-workers-fetch] unexpected source, skipped: ${file}`);
    continue;
  }
  writeFileSync(
    file,
    src
      .replace(FETCH_ORIGINAL, FETCH_PATCHED)
      .replace(PIPE_ORIGINAL, PIPE_PATCHED)
  );
  patched++;
}
console.log(
  `[patch-workers-fetch] google-gax: ${patched} patched, ${stubs.length} found`
);

// --- gaxios@7 (google-auth-library@10 / gcp-metadata) ----------------------
const GAXIOS7_ORIGINAL = `    static async #getFetch() {
        const hasWindow = typeof window !== 'undefined' && !!window;`;
const GAXIOS7_PATCHED = `    static async #getFetch() {
        ${MARKER}
        if (typeof navigator !== 'undefined' &&
            navigator.userAgent === 'Cloudflare-Workers' &&
            typeof globalThis.fetch === 'function') {
            this.#fetch ||= globalThis.fetch.bind(globalThis);
            return this.#fetch;
        }
        const hasWindow = typeof window !== 'undefined' && !!window;`;

// --- gaxios@6 ----------------------------------------------------------------
const GAXIOS6_ORIGINAL = `const fetch = hasFetch() ? window.fetch : node_fetch_1.default;`;
const GAXIOS6_PATCHED = `${MARKER}
const fetch = typeof navigator !== 'undefined' &&
    navigator.userAgent === 'Cloudflare-Workers' &&
    typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : hasFetch() ? window.fetch : node_fetch_1.default;`;

function findGaxios(nodeModules, out) {
  if (!existsSync(nodeModules)) return;
  for (const name of readdirSync(nodeModules)) {
    if (name.startsWith('.')) continue;
    const full = join(nodeModules, name);
    if (name.startsWith('@')) {
      if (statSync(full).isDirectory()) findGaxios(full, out);
      continue;
    }
    if (name === 'gaxios') {
      for (const rel of [
        'build/src/gaxios.js',
        'build/cjs/src/gaxios.js',
        'build/esm/src/gaxios.js'
      ]) {
        const file = join(full, rel);
        if (existsSync(file)) out.push(file);
      }
    }
    findGaxios(join(full, 'node_modules'), out);
  }
}

const gaxiosFiles = [];
findGaxios(join(process.cwd(), 'node_modules'), gaxiosFiles);
let gaxiosPatched = 0;
for (const file of gaxiosFiles) {
  const src = readFileSync(file, 'utf8');
  if (src.includes(MARKER)) continue;
  let next = null;
  if (src.includes(GAXIOS7_ORIGINAL))
    next = src.replace(GAXIOS7_ORIGINAL, GAXIOS7_PATCHED);
  else if (src.includes(GAXIOS6_ORIGINAL))
    next = src.replace(GAXIOS6_ORIGINAL, GAXIOS6_PATCHED);
  if (!next) {
    console.warn(
      `[patch-workers-fetch] unexpected gaxios source, skipped: ${file}`
    );
    continue;
  }
  writeFileSync(file, next);
  gaxiosPatched++;
}
console.log(
  `[patch-workers-fetch] gaxios: ${gaxiosPatched} patched, ${gaxiosFiles.length} found`
);
