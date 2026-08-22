import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';

/** Temporary diagnostic route to inspect ffmpeg availability in the lambda. */
export default function diagHandler(
  _req: NextApiRequest,
  res: NextApiResponse<Record<string, unknown>>
): void {
  const out: Record<string, unknown> = {
    cwd: process.cwd(),
    dirname: __dirname
  };

  // Recursively scan /var/task (bounded) for any file named ffmpeg*.
  const hits: string[] = [];
  const scan = (dir: string, depth: number): void => {
    if (depth > 4) return;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) scan(full, depth + 1);
      else if (entry.toLowerCase().includes('ffmpeg'))
        hits.push(`${full} (${statSync(full).size})`);
    }
  };
  scan('/var/task', 0);
  out['ffmpeg files found'] = hits;

  try {
    out['ffmpeg-static dir'] = readdirSync(
      join('/var/task', 'node_modules', 'ffmpeg-static')
    );
  } catch (error) {
    out['ffmpeg-static dir'] = String(error);
  }
  out['resolved'] = existsSync(
    join('/var/task', 'node_modules', 'ffmpeg-static', 'ffmpeg')
  );
  res.status(200).json(out);
}
