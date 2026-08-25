import {
  clearImpersonation,
  isImpersonating,
  readImpersonation,
  shouldAttachPushToken,
  writeImpersonation
} from '../impersonation';

describe('impersonation session', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and clears an admin takeover session', () => {
    expect(readImpersonation()).toBeNull();
    writeImpersonation({
      userId: 'u1',
      username: 'Salem',
      name: 'سالم'
    });
    expect(readImpersonation()).toEqual({
      userId: 'u1',
      username: 'salem',
      name: 'سالم'
    });
    expect(isImpersonating('u1')).toBe(true);
    expect(isImpersonating('other')).toBe(false);
    expect(shouldAttachPushToken('u1')).toBe(false);
    clearImpersonation();
    expect(readImpersonation()).toBeNull();
    expect(shouldAttachPushToken('u1')).toBe(true);
  });
});
