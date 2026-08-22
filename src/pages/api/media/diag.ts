import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';

/** Temporary diagnostic route to inspect ffmpeg availability in the lambda. */
export default function diagHandler(
  _req: NextApiRequest,
  res: NextApiResponse<Record<string, unknown>>
): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const resolved = require('ffmpeg-static') as string | null;
  const out: Record<string, unknown> = {
    cwd: process.cwd(),
    dirname: __dirname,
    resolved
  };
  const candidates = [
    resolved,
    join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join('/var/task', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join('/var/task', 'server', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    join('/var/task', '.next', 'server', 'node_modules', 'ffmpeg-static', 'ffmpeg')
  ];
  for (const p of candidates) {
    if (!p) continue;
    try {
      out[p] = {
        exists: existsSync(p),
        size: existsSync(p) ? statSync(p).size : null
      };
    } catch (error) {
      out[p] = String(error);
    }
  }
  // List what ffmpeg-static actually contains in the lambda.
  const pkgDir = join('/var/task', 'node_modules', 'ffmpeg-static');
  try {
    out['pkgDir listing'] = readdirSync(pkgDir);
  } catch (error) {
    out['pkgDir listing'] = String(error);
  }
  res.status(200).json(out);
}
