/**
 * Material 3 Expressive / Google Play download ring.
 * A sine wave rides a circular arc; amplitude fades at both ends
 * so the stroke tapers into the gap like Play Store.
 */

export const STORY_RING_VIEWBOX = 100;
export const STORY_RING_RADIUS = 42;
export const STORY_RING_AMPLITUDE = 3.15;
export const STORY_RING_WAVES = 15;
export const STORY_RING_SWEEP = 0.86;
export const STORY_RING_TAIL_START = 0.93;
export const STORY_RING_TAIL_SWEEP = 0.035;

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
  const ramp = opts.ramp ?? 0.12;
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
  const samples = opts.samples ?? 360;
  const parts: string[] = [];

  for (let i = 0; i <= samples; i++) {
    const { x, y } = wavyArcPoint(i / samples, opts);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`);
  }

  return parts.join(' ');
}

const shared = {
  radius: STORY_RING_RADIUS,
  amplitude: STORY_RING_AMPLITUDE,
  waves: STORY_RING_WAVES,
  samples: 360
};

/** Main Play-style crinkled arc (~86% of the circle). */
export const STORY_RING_MAIN_PATH = wavyArcPath({
  ...shared,
  sweep: STORY_RING_SWEEP,
  start: -Math.PI / 2
});

/** Tiny detached dash after the gap — matches the Play Store tail. */
export const STORY_RING_TAIL_PATH = wavyArcPath({
  ...shared,
  amplitude: 1.15,
  sweep: STORY_RING_TAIL_SWEEP,
  start: -Math.PI / 2 + STORY_RING_TAIL_START * Math.PI * 2,
  ramp: 0.4,
  samples: 24
});
