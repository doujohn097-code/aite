#!/usr/bin/env node
/**
 * google-gax (وضع REST/fallback الذي يستخدمه firebase-admin مع preferRest)
 * يختار node-fetch@2 دائماً خارج المتصفح. على Cloudflare Workers يمر node-fetch
 * عبر محاكاة node:http في workerd التي تتعطل مع ترويسات المصفوفات
 * ("Cannot read properties of null (reading 'has')")، فتفشل كل استعلامات
 * Firestore من الخادم.
 *
 * الحل: على Workers فقط نستخدم fetch الأصلية، ونحوّل جسم الاستجابة (Web
 * ReadableStream) إلى Readable الخاص بـ Node قبل تمريره إلى stream.pipeline.
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
    console.warn(`[patch-google-gax] unexpected source, skipped: ${file}`);
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
  `[patch-google-gax] native fetch on Workers: ${patched} patched, ${stubs.length} found`
);
