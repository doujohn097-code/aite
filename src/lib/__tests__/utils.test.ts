import {
  preventBubbling,
  sleep,
  getStatsMove,
  isPlural,
  withoutId,
  usernameToInternalEmail,
  internalEmailToUsername,
  isPlaceholderProfileName,
  isPlaceholderUsername
} from '../utils';

describe('preventBubbling', () => {
  const stopPropagation = jest.fn();
  const preventDefault = jest.fn();
  const makeEvent = (): React.SyntheticEvent =>
    ({
      stopPropagation,
      preventDefault
    } as unknown as React.SyntheticEvent);

  beforeEach(() => {
    stopPropagation.mockClear();
    preventDefault.mockClear();
  });

  it('stops propagation and prevents default by default', () => {
    const handler = preventBubbling();
    const event = makeEvent();

    handler(event);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('does not call preventDefault when noPreventDefault is true', () => {
    const handler = preventBubbling(undefined, true);
    handler(makeEvent());

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('invokes the provided callback and returns its value', () => {
    const callback = jest.fn(() => 'result');
    const handler = preventBubbling(callback);

    expect(handler(makeEvent())).toBe('result');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when no callback is provided', () => {
    expect(preventBubbling(null)(makeEvent())).toBeUndefined();
  });
});

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it('resolves with undefined', async () => {
    await expect(sleep(10)).resolves.toBeUndefined();
  });
});

describe('getStatsMove', () => {
  it('returns motion props with the configured pixel offset', () => {
    const move = getStatsMove(20);
    expect(move.initial).toEqual({ opacity: 0, y: -20 });
    expect(move.animate).toEqual({ opacity: 1, y: 0 });
    expect(move.exit).toEqual({ opacity: 0, y: 20 });
    expect(move.transition).toMatchObject({ type: 'tween', duration: 0.15 });
  });

  it('supports a zero offset', () => {
    const move = getStatsMove(0);
    expect(move.initial).toMatchObject({ opacity: 0 });
    expect(move.exit).toMatchObject({ opacity: 0 });
  });
});

describe('isPlural', () => {
  it("returns 's' when count is greater than 1", () => {
    expect(isPlural(2)).toBe('s');
  });

  it('returns an empty string when count is 1 or less', () => {
    expect(isPlural(1)).toBe('');
    expect(isPlural(0)).toBe('');
  });
});

describe('withoutId', () => {
  it('returns a copy of the object without the id field', () => {
    const obj = { id: 'abc', name: 'test', value: 42 };
    const result = withoutId(obj);

    expect(result).toEqual({ name: 'test', value: 42 });
    expect(result).not.toHaveProperty('id');
  });

  it('does not mutate the original object', () => {
    const obj = { id: 'abc', name: 'test' };
    withoutId(obj);
    expect(obj).toEqual({ id: 'abc', name: 'test' });
  });
});

describe('usernameToInternalEmail', () => {
  it('produces an email ending with the aite.local domain', () => {
    expect(usernameToInternalEmail('alice')).toMatch(/@aite\.local$/);
  });

  it('normalizes casing and trims whitespace before encoding', () => {
    expect(usernameToInternalEmail('  Alice  ')).toBe(
      usernameToInternalEmail('alice')
    );
  });

  it('produces a base64url-safe local part (no +, /, or =)', () => {
    const email = usernameToInternalEmail('some_user-123');
    const local = email.split('@')[0];
    expect(local).not.toMatch(/[+/=]/);
  });

  it('truncates the local part to 60 characters', () => {
    const email = usernameToInternalEmail('a'.repeat(200));
    const local = email.split('@')[0];
    expect(local.length).toBeLessThanOrEqual(60);
  });

  it('maps the same username to the same email deterministically', () => {
    expect(usernameToInternalEmail('bob')).toBe(usernameToInternalEmail('bob'));
  });

  it('can restore a valid username from the internal email', () => {
    const email = usernameToInternalEmail('salem_125');
    expect(internalEmailToUsername(email)).toBe('salem_125');
  });

  it('does not decode unrelated or malformed email addresses', () => {
    expect(internalEmailToUsername('person@example.com')).toBeNull();
    expect(internalEmailToUsername('%%%@@aite.local')).toBeNull();
  });
});

describe('placeholder profile detection', () => {
  it('recognizes legacy Arabic and English generated names', () => {
    expect(isPlaceholderProfileName('مستخدم')).toBe(true);
    expect(isPlaceholderProfileName('مستحدم_125')).toBe(true);
    expect(isPlaceholderProfileName('user-942')).toBe(true);
  });

  it('keeps real display names unchanged', () => {
    expect(isPlaceholderProfileName('سالم أحمد')).toBe(false);
    expect(isPlaceholderProfileName('Salem')).toBe(false);
  });

  it('recognizes generated usernames without touching real usernames', () => {
    expect(isPlaceholderUsername('unknown')).toBe(true);
    expect(isPlaceholderUsername('مستخدم125')).toBe(true);
    expect(isPlaceholderUsername('user_8721')).toBe(true);
    expect(isPlaceholderUsername('salem_125')).toBe(false);
  });
});
