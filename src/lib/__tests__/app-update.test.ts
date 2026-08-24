import {
  isSafeApkUrl,
  shouldOfferUpdate,
  updateAppliesTo
} from '../app-update';
import type { AppUpdate } from '../types/app-update';

const update = (partial: Partial<AppUpdate>): AppUpdate => ({
  id: 'u1',
  active: true,
  force: false,
  versionName: '1.3.0',
  versionCode: 6,
  title: 'تحديث',
  message: '',
  apkUrl: 'https://cdn.example.com/aite.apk',
  target: 'all',
  createdAt: null,
  ...partial
});

describe('app update helpers', () => {
  it('accepts https apk urls and rejects private hosts', () => {
    expect(isSafeApkUrl('https://files.example.com/app.apk')).toBe(true);
    expect(isSafeApkUrl('http://files.example.com/app.apk')).toBe(false);
    expect(isSafeApkUrl('https://127.0.0.1/app.apk')).toBe(false);
  });

  it('respects android/web targeting', () => {
    expect(updateAppliesTo('android', true)).toBe(true);
    expect(updateAppliesTo('android', false)).toBe(false);
    expect(updateAppliesTo('web', false)).toBe(true);
    expect(updateAppliesTo('all', true)).toBe(true);
  });

  it('hides an already-installed native version', () => {
    expect(
      shouldOfferUpdate(update({ versionCode: 5 }), {
        versionCode: 5,
        versionName: '1.2.0'
      })
    ).toBe(false);
    expect(
      shouldOfferUpdate(update({ versionCode: 6 }), {
        versionCode: 5,
        versionName: '1.2.0'
      })
    ).toBe(true);
  });
});
