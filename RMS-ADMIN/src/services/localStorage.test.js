import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthState, setAuthState, clearAuthState } from './localStorage.js';

function createWindowWithStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  const localStorage = {
    getItem(key) {
      return store.has(key) ? String(store.get(key)) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };

  return {
    localStorage,
    __RMS_AUTH_TOKEN: initial.__RMS_AUTH_TOKEN || '',
    __rms_inmemory_token: initial.__rms_inmemory_token || '',
  };
}

test('loadAuthState treats stale auth flags without a token as logged out', () => {
  const previousWindow = globalThis.window;
  globalThis.window = createWindowWithStorage({ rms_admin_auth: 'true' });

  try {
    assert.equal(loadAuthState(), false);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('setAuthState stores the authentication flag only when a valid token exists', () => {
  const previousWindow = globalThis.window;
  globalThis.window = createWindowWithStorage();

  try {
    setAuthState(true);
    assert.equal(loadAuthState(), false);

    globalThis.window.localStorage.setItem('rms_admin_token', 'abc');
    setAuthState(true);
    assert.equal(loadAuthState(), true);

    clearAuthState();
    assert.equal(loadAuthState(), false);
  } finally {
    globalThis.window = previousWindow;
  }
});
