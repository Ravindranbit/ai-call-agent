// Simple in-memory store for recent gather payloads (debug only)
const MAX_ENTRIES = 50;
const store = [];

function push(entry) {
  try {
    const item = {
      timestamp: new Date().toISOString(),
      body: entry || {}
    };
    store.unshift(item);
    if (store.length > MAX_ENTRIES) store.pop();
  } catch (err) {
    // swallow errors - debug store must not crash the app
    console.error('gatherStore push error', err?.message || String(err));
  }
}

function list() {
  return store.slice();
}

function clear() {
  store.length = 0;
}

module.exports = { push, list, clear };
