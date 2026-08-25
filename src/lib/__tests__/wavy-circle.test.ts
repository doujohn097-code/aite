import {
  amplitudeFade,
  STORY_RING_FRAMES,
  STORY_RING_MAIN_PATH,
  STORY_RING_PHASE_PATHS,
  STORY_RING_RADIUS,
  storyRingGutter,
  wavyArcPath,
  wavyArcPoint
} from '../wavy-circle';

describe('wavy circle (Play Store ring)', () => {
  it('builds a closed full-circle SVG path', () => {
    expect(STORY_RING_MAIN_PATH.startsWith('M')).toBe(true);
    expect(STORY_RING_MAIN_PATH).toContain(' L');
    expect(STORY_RING_MAIN_PATH.endsWith('Z')).toBe(true);

    const start = wavyArcPoint(0, { sweep: 1, ramp: 0 });
    expect(start.x).toBeCloseTo(50, 1);
    expect(start.y).toBeLessThan(50);
  });

  it('keeps a constant wave around a full circle', () => {
    expect(amplitudeFade(0, 0)).toBe(1);
    expect(amplitudeFade(0.5, 0.12)).toBe(1);

    const mid = wavyArcPoint(0.125, { sweep: 1, ramp: 0 });
    expect(Math.abs(mid.radius - STORY_RING_RADIUS)).toBeGreaterThan(0.4);
  });

  it('shifts the wave when the phase changes', () => {
    const a = wavyArcPoint(0.2, { phase: 0, ramp: 0 });
    const b = wavyArcPoint(0.2, { phase: Math.PI, ramp: 0 });
    expect(a.radius).not.toBeCloseTo(b.radius, 1);
    expect(wavyArcPath({ sweep: 0.5, samples: 40, closed: false })).toMatch(
      /^M/
    );
  });

  it('precomputes a looping set of phase frames', () => {
    expect(STORY_RING_PHASE_PATHS).toHaveLength(STORY_RING_FRAMES);
    expect(STORY_RING_PHASE_PATHS[0]).toBe(STORY_RING_MAIN_PATH);
    expect(new Set(STORY_RING_PHASE_PATHS).size).toBe(STORY_RING_FRAMES);
  });

  it('leaves enough gutter for the wave to sit outside the photo', () => {
    expect(storyRingGutter(56)).toBeGreaterThanOrEqual(11);
    expect(storyRingGutter(40)).toBeGreaterThanOrEqual(11);
  });
});
