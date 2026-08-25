/**
 * Material 3 Expressive / Google Play download ring.
 * A closed sine wave rides a full circle; phase frames make the
 * scallops crawl so the motion is a wave, not a rigid spin.
 */

export const STORY_RING_VIEWBOX = 100;
export const STORY_RING_RADIUS = 44.2;
export const STORY_RING_AMPLITUDE = 3.85;
export const STORY_RING_WAVES = 14;
export const STORY_RING_SWEEP = 1;
export const STORY_RING_FRAMES = 12;

export type WavyArcOptions = {
  cx?: number;
  cy?: number;
  radius?: number;
  amplitude?: number;
  waves?: number;
  /** Fraction of the circle that is drawn (0–1). */
  sweep?: number;
  /** Radians. Default starts at 12 o'clock. */
  start?: number;
  phase?: number;
  /** 0–0.5 — fade amplitude at both ends of the arc. */
  ramp?: number;
  samples?: number;
  closed?: boolean;
};

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function amplitudeFade(u: number, ramp: number): number {
  if (ramp <= 0) return 1;
  if (u < ramp) return smoothstep(u / ramp);
  if (u > 1 - ramp) return smoothstep((1 - u) / ramp);
  return 1;
}

export function wavyArcPoint(
  u: number,
  opts: WavyArcOptions = {}
): { x: number; y: number; radius: number } {
  const cx = opts.cx ?? STORY_RING_VIEWBOX / 2;
  const cy = opts.cy ?? STORY_RING_VIEWBOX / 2;
  const radius = opts.radius ?? STORY_RING_RADIUS;
  const amplitude = opts.amplitude ?? STORY_RING_AMPLITUDE;
  const waves = opts.waves ?? STORY_RING_WAVES;
  const sweep = opts.sweep ?? STORY_RING_SWEEP;
  const start = opts.start ?? -Math.PI / 2;
  const phase = opts.phase ?? 0;
  const ramp = opts.ramp ?? 0;
  const total = sweep * Math.PI * 2;
  const theta = start + u * total;
  const fade = amplitudeFade(u, ramp);
  const r =
    radius +
    amplitude * fade * Math.sin(u * sweep * waves * Math.PI * 2 + phase);
  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
    radius: r
  };
}

export function wavyArcPath(opts: WavyArcOptions = {}): string {
  const samples = opts.samples ?? 168;
  const closed = opts.closed ?? (opts.sweep === undefined || opts.sweep >= 1);
  const parts: string[] = [];

  for (let i = 0; i <= samples; i++) {
    const { x, y } = wavyArcPoint(i / samples, {
      ...opts,
      ramp: opts.ramp ?? 0
    });
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  if (closed) parts.push('Z');
  return parts.join(' ');
}

const ringOpts = {
  radius: STORY_RING_RADIUS,
  amplitude: STORY_RING_AMPLITUDE,
  waves: STORY_RING_WAVES,
  sweep: 1,
  ramp: 0,
  closed: true,
  samples: 168
};

/** Closed wavy circle at phase 0. */
export const STORY_RING_MAIN_PATH = wavyArcPath(ringOpts);

/** Phase-shifted frames — cycling these crawls the wave around the photo. */
export const STORY_RING_PHASE_PATHS: string[] = Array.from(
  { length: STORY_RING_FRAMES },
  (_, index) =>
    wavyArcPath({
      ...ringOpts,
      phase: (index / STORY_RING_FRAMES) * Math.PI * 2
    })
);

/** Extra pixels around the photo so the full wave sits outside the face. */
export function storyRingGutter(photoSize: number): number {
  return Math.max(11, Math.round(photoSize * 0.24));
}
