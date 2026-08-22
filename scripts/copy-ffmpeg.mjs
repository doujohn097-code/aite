#!/usr/bin/env node
/**
 * Makes sure the ffmpeg binary lands inside Next.js's traced/standalone
 * output so the /api/media/normalize and /api/media/poster serverless
 * functions can re-encode videos and extract poster frames.
 *
 * Vercel now blocks npm install scripts by default (allow-scripts), so
 * ffmpeg-static's postinstall may never download the binary. If it's
 * missing, we download the official linux x64 build directly.
 *
 * Next 12's nft tracing only picks up ffmpeg-static's JS wrapper, not the
 * ~80 MB binary it points to. Vercel packages `.next/standalone` verbatim
 * (output: 'standalone'), so dropping the binary next to its wrapper there
 * is enough for the lambda to find it at runtime.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg');

async function ensureBinary() {
  if (existsSync(source) && statSync(source).size > 1_000_000) {
    return source;
  }
  console.log('[copy-ffmpeg] binary missing — downloading ffmpeg linux-x64…');
  const url =
    process.env.FFMPEG_STATIC_URL ??
    'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64';
  mkdirSync(dirname(source), { recursive: true });
  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      console.warn(`[copy-ffmpeg] download failed: ${response.status}`);
      return null;
    }
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(source)
    );
    const size = statSync(source).size;
    if (size < 1_000_000) {
      console.warn('[copy-ffmpeg] downloaded binary looks wrong, skipping');
      return null;
    }
    console.log(`[copy-ffmpeg] downloaded ${Math.round(size / 1024 / 1024)} MB`);
    return source;
  } catch (error) {
    console.warn('[copy-ffmpeg] download error:', String(error));
    return null;
  }
}

const binary = await ensureBinary();
if (!binary) {
  console.warn('[copy-ffmpeg] no ffmpeg binary available, skipping');
  process.exit(0);
}

const targets = [
  join(root, '.next', 'standalone', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  join(root, '.next', 'server', 'node_modules', 'ffmpeg-static', 'ffmpeg')
];

let copied = 0;
for (const target of targets) {
  try {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(binary, target);
    copied += 1;
  } catch {
    // Standalone output may not exist on every platform; that's fine.
  }
}

console.log(
  `[copy-ffmpeg] copied binary into ${copied}/${targets.length} output dirs (${Math.round(statSync(binary).size / 1024 / 1024)} MB)`
);
