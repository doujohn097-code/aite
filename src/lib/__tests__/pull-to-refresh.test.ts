import {
  PULL_MAX,
  elementScrollTop,
  isAtScrollSurface,
  isMostlyVertical,
  resistPull,
  shouldArmPull
} from '../pull-to-refresh';

describe('resistPull', () => {
  it('returns 0 for upward or zero movement', () => {
    expect(resistPull(0)).toBe(0);
    expect(resistPull(-20)).toBe(0);
  });

  it('grows slower than the raw finger distance', () => {
    expect(resistPull(80)).toBeLessThan(80);
    expect(resistPull(80)).toBeGreaterThan(20);
  });

  it('never exceeds the max', () => {
    expect(resistPull(4000)).toBe(PULL_MAX);
  });
});

describe('isMostlyVertical', () => {
  it('rejects tiny or sideways movement', () => {
    expect(isMostlyVertical(40, 8)).toBe(false);
    expect(isMostlyVertical(50, 20)).toBe(false);
  });

  it('accepts a downward swipe', () => {
    expect(isMostlyVertical(4, 40)).toBe(true);
  });
});

describe('shouldArmPull', () => {
  it('arms only at the surface while idle', () => {
    expect(shouldArmPull({ atSurface: true })).toBe(true);
    expect(shouldArmPull({ atSurface: false })).toBe(false);
    expect(shouldArmPull({ atSurface: true, disabled: true })).toBe(false);
    expect(shouldArmPull({ atSurface: true, refreshing: true })).toBe(false);
  });
});

describe('elementScrollTop', () => {
  it('reads an element scrollTop', () => {
    expect(elementScrollTop({ scrollTop: 18 } as HTMLElement)).toBe(18);
  });
});

describe('isAtScrollSurface', () => {
  const root = { scrollTop: 0, parentElement: null } as unknown as HTMLElement;

  beforeEach(() => {
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: () => ({ overflowY: 'visible' })
    });
    Object.defineProperty(window, 'scrollY', { writable: true, value: 0 });
    Object.defineProperty(document.documentElement, 'scrollTop', {
      writable: true,
      value: 0
    });
  });

  it('is true at the window top', () => {
    expect(isAtScrollSurface(document.body, null)).toBe(true);
  });

  it('is false when the window is mid-scroll', () => {
    Object.defineProperty(window, 'scrollY', { writable: true, value: 240 });
    expect(isAtScrollSurface(document.body, null)).toBe(false);
  });

  it('is false when the dedicated scroller is mid-list', () => {
    const mid = { scrollTop: 320 } as HTMLElement;
    expect(isAtScrollSurface(document.body, mid)).toBe(false);
    expect(isAtScrollSurface(document.body, root)).toBe(true);
  });
});
