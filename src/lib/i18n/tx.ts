import { translate, type MessageKey, type MessageParams } from './index';
import { getActiveLocale } from './locale-store';

export function tx(key: MessageKey, params?: MessageParams): string {
  return translate(getActiveLocale(), key, params);
}
