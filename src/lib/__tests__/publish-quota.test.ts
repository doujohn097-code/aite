import {
  PUBLISH_COOLDOWN_MS,
  PUBLISH_HOUR_LIMIT,
  nextPublishQuota
} from '../publish-quota';

const now = 1_700_000_000_000;

function ts(ms: number): { toMillis: () => number } {
  return { toMillis: () => ms };
}

describe('nextPublishQuota', () => {
  it('allows a first publish', () => {
    const result = nextPublishQuota({}, now);
    expect(result.allowed).toBe(true);
    expect(result.resetWindow).toBe(true);
    expect(result.publishWindowCount).toBe(1);
  });

  it('blocks another publish inside the cooldown', () => {
    const result = nextPublishQuota(
      {
        lastPublishAt: ts(now - 3_000),
        publishWindowStart: ts(now - 3_000),
        publishWindowCount: 1
      },
      now
    );
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(PUBLISH_COOLDOWN_MS - 3_000);
    expect(result.message).toMatch(/انتظر/);
  });

  it('allows a publish after the cooldown', () => {
    const result = nextPublishQuota(
      {
        lastPublishAt: ts(now - PUBLISH_COOLDOWN_MS - 50),
        publishWindowStart: ts(now - 60_000),
        publishWindowCount: 2
      },
      now
    );
    expect(result.allowed).toBe(true);
    expect(result.resetWindow).toBe(false);
    expect(result.publishWindowCount).toBe(3);
  });

  it('blocks after the hourly cap', () => {
    const result = nextPublishQuota(
      {
        lastPublishAt: ts(now - PUBLISH_COOLDOWN_MS - 50),
        publishWindowStart: ts(now - 5 * 60_000),
        publishWindowCount: PUBLISH_HOUR_LIMIT
      },
      now
    );
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/حد/);
  });

  it('resets the hourly window after an hour', () => {
    const result = nextPublishQuota(
      {
        lastPublishAt: ts(now - PUBLISH_COOLDOWN_MS - 50),
        publishWindowStart: ts(now - 61 * 60_000),
        publishWindowCount: PUBLISH_HOUR_LIMIT
      },
      now
    );
    expect(result.allowed).toBe(true);
    expect(result.resetWindow).toBe(true);
    expect(result.publishWindowCount).toBe(1);
  });
});
