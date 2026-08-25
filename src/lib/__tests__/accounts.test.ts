import { getSavedAccounts, saveAccount } from '../accounts';

const KEY = 'aite:saved-accounts';

describe('saved account security', () => {
  beforeEach(() => localStorage.clear());

  it('removes legacy plaintext passwords during migration', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        {
          username: 'salem',
          password: 'plaintext-secret',
          name: 'Salem',
          photoURL: null,
          provider: 'password',
          savedAt: 1
        }
      ])
    );

    expect(getSavedAccounts()).toEqual([
      {
        username: 'salem',
        name: 'Salem',
        photoURL: null,
        provider: 'password',
        savedAt: 1
      }
    ]);
    expect(localStorage.getItem(KEY)).not.toContain('plaintext-secret');
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as object[];
    expect(stored[0]).not.toHaveProperty('password');
  });

  it('stores account metadata without credentials', () => {
    saveAccount({
      username: 'john_12',
      name: 'John',
      photoURL: null,
      provider: 'password'
    });
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as object[];
    expect(stored[0]).not.toHaveProperty('password');
  });

  it('keeps accounts even when photoURL is missing', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([{ username: 'sara', savedAt: 1 }])
    );
    expect(getSavedAccounts()).toEqual([
      {
        username: 'sara',
        name: 'sara',
        photoURL: null,
        provider: 'password',
        savedAt: 1
      }
    ]);
  });
});
