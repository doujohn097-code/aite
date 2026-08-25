import {
  amplitudeFade,
  STORY_RING_MAIN_PATH,
  STORY_RING_RADIUS,
  STORY_RING_TAIL_PATH,
  wavyArcPath,
  wavyArcPoint
} from '../wavy-circle';

describe('wavy circle (Play Store ring)', () => {
  it('builds an open SVG path that starts at the top of the circle', () => {
    expect(STORY_RING_MAIN_PATH.startsWith('M')).toBe(true);
    expect(STORY_RING_MAIN_PATH).toContain(' L');
    expect(STORY_RING_MAIN_PATH.endsWith('Z')).toBe(false);
    expect(STORY_RING_TAIL_PATH.startsWith('M')).toBe(true);

    const start = wavyArcPoint(0, { sweep: 0.86 });
    expect(start.x).toBeCloseTo(50, 1);
    expect(start.y).toBeLessThan(50);
  });

  it('fades amplitude at both ends so the wave tapers into the gap', () => {
    expect(amplitudeFade(0, 0.12)).toBe(0);
    expect(amplitudeFade(0.5, 0.12)).toBe(1);
    expect(amplitudeFade(1, 0.12)).toBe(0);

    const mid = wavyArcPoint(0.5);
    const end = wavyArcPoint(1);
    expect(Math.abs(mid.radius - STORY_RING_RADIUS)).toBeGreaterThan(0.4);
    expect(Math.abs(end.radius - STORY_RING_RADIUS)).toBeLessThan(0.2);
  });

  it('places the end of a fuller sweep further around the circle', () => {
    const shortEnd = wavyArcPoint(1, { sweep: 0.4 });
    const longEnd = wavyArcPoint(1, { sweep: 0.9 });
    const shortAngle = Math.atan2(shortEnd.y - 50, shortEnd.x - 50);
    const longAngle = Math.atan2(longEnd.y - 50, longEnd.x - 50);
    expect(longAngle).not.toBeCloseTo(shortAngle, 1);
    expect(wavyArcPath({ sweep: 0.5, samples: 40 })).toMatch(/^M/);
  });
});
