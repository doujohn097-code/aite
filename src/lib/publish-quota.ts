import { getTimestampMillis } from './date';

export const PUBLISH_COOLDOWN_MS = 10_000;
export const PUBLISH_HOUR_LIMIT = 25;
export const PUBLISH_HOUR_MS = 60 * 60 * 1000;

export type PublishQuotaInput = {
  lastPublishAt?: { toMillis?: () => number; seconds?: number } | null;
  publishWindowStart?: { toMillis?: () => number; seconds?: number } | null;
  publishWindowCount?: number | null;
};

export type PublishQuotaResult = {
  allowed: boolean;
  resetWindow: boolean;
  publishWindowCount: number;
  retryAfterMs: number;
  message: string;
};

export function nextPublishQuota(
  input: PublishQuotaInput | null | undefined,
  nowMs = Date.now()
): PublishQuotaResult {
  const last = getTimestampMillis(input?.lastPublishAt);
  const windowStart = getTimestampMillis(input?.publishWindowStart);
  const count = Math.max(0, input?.publishWindowCount ?? 0);
  const sinceLast = last ? nowMs - last : PUBLISH_COOLDOWN_MS;
  const resetWindow = !windowStart || nowMs - windowStart >= PUBLISH_HOUR_MS;
  const nextCount = resetWindow ? 1 : count + 1;

  if (last && sinceLast < PUBLISH_COOLDOWN_MS) {
    const retryAfterMs = PUBLISH_COOLDOWN_MS - sinceLast;
    return {
      allowed: false,
      resetWindow,
      publishWindowCount: count,
      retryAfterMs,
      message: `انتظر ${Math.max(1, Math.ceil(retryAfterMs / 1000))} ثوانٍ قبل النشر مرة أخرى`
    };
  }

  if (!resetWindow && nextCount > PUBLISH_HOUR_LIMIT) {
    const retryAfterMs = Math.max(1000, PUBLISH_HOUR_MS - (nowMs - windowStart));
    return {
      allowed: false,
      resetWindow: false,
      publishWindowCount: count,
      retryAfterMs,
      message: `وصلت للحد الأقصى (${PUBLISH_HOUR_LIMIT} منشوراً في الساعة). حاول لاحقاً`
    };
  }

  return {
    allowed: true,
    resetWindow,
    publishWindowCount: nextCount,
    retryAfterMs: 0,
    message: ''
  };
}
