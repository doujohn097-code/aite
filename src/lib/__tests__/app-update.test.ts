import {
  isSafeApkUrl,
  parseUpdateProgress,
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
    expect(
      isSafeApkUrl(
        'https://pub-ac6ca2c23fe44a8c93e7a74791c80260.r2.dev/Aite.apk'
      )
    ).toBe(true);
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
    expect(
      shouldOfferUpdate(update({ versionCode: 6 }), {
        versionCode: 6,
        versionName: '1.2.1'
      })
    ).toBe(false);
  });

  it('hides the prompt on the current web build', () => {
    expect(shouldOfferUpdate(update({ versionCode: 6 }), null)).toBe(false);
    expect(shouldOfferUpdate(update({ versionCode: 7 }), null)).toBe(true);
  });

  it('waits for the native bridge before offering an android update', () => {
    expect(
      shouldOfferUpdate(update({ versionCode: 7 }), null, {
        waitForNative: true
      })
    ).toBe(false);
  });

  it('parses native download progress events', () => {
    expect(parseUpdateProgress({ status: 'downloading', percent: 42 })).toEqual(
      {
        status: 'downloading',
        percent: 42,
        message: undefined
      }
    );
    expect(parseUpdateProgress({ status: 'nope', percent: 10 })).toBeNull();
  });
});
