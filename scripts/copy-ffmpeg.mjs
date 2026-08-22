#!/usr/bin/env node
/**
 * Copies the ffmpeg-static binary into Next.js's traced/standalone output so
 * the /api/media/normalize serverless function can re-encode videos.
 *
 * Next 12's nft tracing only picks up ffmpeg-static's JS wrapper, not the
 * ~80 MB binary it points to. Vercel packages `.next/standalone` verbatim
 * (output: 'standalone'), so dropping the binary next to its wrapper there
 * is enough for the lambda to find it at runtime.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'ffmpeg-static', 'ffmpeg');

if (!existsSync(source)) {
  console.warn('[copy-ffmpeg] ffmpeg binary not found, skipping');
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
    copyFileSync(source, target);
    copied += 1;
  } catch {
    // Standalone output may not exist on every platform; that's fine.
  }
}

const sizeMb = Math.round(statSync(source).size / 1024 / 1024);
console.log(
  `[copy-ffmpeg] copied binary into ${copied}/${targets.length} output dirs (${sizeMb} MB)`
);
