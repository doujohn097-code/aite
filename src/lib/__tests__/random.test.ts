import { getRandomId, getRandomInt } from '../random';

describe('getRandomId', () => {
  it('returns a string of length 20', () => {
    expect(getRandomId()).toHaveLength(20);
  });

  it('only contains alphanumeric characters', () => {
    const id = getRandomId();
    expect(id).toMatch(/^[A-Za-z0-9]{20}$/);
  });

  it('produces different ids on subsequent calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => getRandomId()));
    // extremely unlikely to produce 100 identical ids
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('getRandomInt', () => {
  it('returns an integer within the inclusive range', () => {
    for (let i = 0; i < 200; i++) {
      const value = getRandomInt(5, 10);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it('returns the bound when min equals max', () => {
    expect(getRandomInt(7, 7)).toBe(7);
  });

  it('handles negative ranges', () => {
    for (let i = 0; i < 100; i++) {
      const value = getRandomInt(-10, -5);
      expect(value).toBeGreaterThanOrEqual(-10);
      expect(value).toBeLessThanOrEqual(-5);
    }
  });
});
