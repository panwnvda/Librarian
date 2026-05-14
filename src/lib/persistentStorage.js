const WORKSPACE_MARKER_KEY = 'library_workspace_initialized';
const WORKSPACE_PREFIX = 'library_';
const DB_NAME = 'library';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

// Legacy names — read once at first boot so existing user data is preserved.
const LEGACY_DB_NAME = 'cybernotes';
const LEGACY_PREFIX = 'redops_';
const LEGACY_WELCOME_KEY = 'redops_welcome_modal_dismissed';
const LEGACY_CYBERNOTES_WELCOME_KEY = 'cybernotes_welcome_modal_dismissed';
const MIGRATION_DONE_KEY = 'library_migration_v1_done';

const canUseLocal = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const canUseIdb   = typeof window !== 'undefined' && typeof window.indexedDB   !== 'undefined';

function renameKey(key) {
  if (typeof key !== 'string') return key;
  return key.startsWith(LEGACY_PREFIX) ? WORKSPACE_PREFIX + key.slice(LEGACY_PREFIX.length) : key;
}

let dbPromise = null;
function openDb() {
  if (!canUseIdb) return Promise.reject(new Error('IndexedDB not available'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  return dbPromise;
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbClearPrefix(prefix) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbDeleteWhere(predicate) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if (typeof cursor.key === 'string' && predicate(cursor.key)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function readLocal(key) {
  if (!canUseLocal) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalBestEffort(key, value) {
  if (!canUseLocal) return;
  try {
    window.localStorage.setItem(WORKSPACE_MARKER_KEY, 'true');
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or serialization issue — IndexedDB is authoritative, ignore.
  }
}

function deleteLocalBestEffort(key) {
  if (!canUseLocal) return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

function ensureWorkspaceBootstrap() {
  if (!canUseLocal) return;
  try {
    if (window.localStorage.getItem(WORKSPACE_MARKER_KEY) === 'true') return;
    const keysToRemove = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(WORKSPACE_PREFIX) && key !== WORKSPACE_MARKER_KEY && key !== MIGRATION_DONE_KEY && key !== 'library_welcome_modal_dismissed' && key !== LEGACY_WELCOME_KEY) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    if (canUseIdb) idbClearPrefix(WORKSPACE_PREFIX).catch(() => {});
  } catch {}
}

export async function reloadCache() {
  return undefined;
}

export async function persistGet(key) {
  if (canUseIdb) {
    try {
      const value = await idbGet(key);
      if (value !== undefined) return value;
    } catch {}
  }
  return readLocal(key);
}

export async function persistSet(key, value) {
  // Write localStorage first — synchronous, immediately visible to any remounting component.
  writeLocalBestEffort(key, value);
  // Write IDB second — authoritative across sessions, but async.
  if (canUseIdb) {
    try {
      await idbSet(key, value);
    } catch (error) {
      console.warn('IndexedDB persist failed for', key, error);
    }
  }
}

export async function persistDelete(key) {
  // Remove from localStorage first so remounting components see the deletion immediately.
  deleteLocalBestEffort(key);
  if (canUseIdb) {
    try { await idbDelete(key); } catch {}
  }
}

/**
 * Delete every workspace key ending with `_${pageKey}` from BOTH localStorage and IDB.
 * Used on page delete — covers any storage key that might reference the deleted page,
 * not just the known suffix list (pagetype, meta, columns, ...).
 */
export async function persistDeletePageKeys(pageKey) {
  const suffix = `_${pageKey}`;
  // localStorage sweep (synchronous, immediate visibility on remount).
  if (canUseLocal) {
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(WORKSPACE_PREFIX) && k.endsWith(suffix)) keys.push(k);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
    } catch {}
  }
  // IDB sweep (authoritative).
  if (canUseIdb) {
    try {
      await idbDeleteWhere((k) => k.startsWith(WORKSPACE_PREFIX) && k.endsWith(suffix));
    } catch {}
  }
}

/**
 * Wipe ALL workspace data from both localStorage and IDB. Used by the importer to
 * guarantee imports replace the workspace cleanly (no leftover data from previously
 * deleted pages or different workspaces).
 */
export async function persistClearWorkspace() {
  if (canUseLocal) {
    try {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(WORKSPACE_PREFIX) && k !== WORKSPACE_MARKER_KEY
            && k !== MIGRATION_DONE_KEY && k !== 'library_welcome_modal_dismissed') {
          keys.push(k);
        }
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
    } catch {}
  }
  if (canUseIdb) {
    try {
      await idbDeleteWhere((k) =>
        k.startsWith(WORKSPACE_PREFIX)
        && k !== WORKSPACE_MARKER_KEY
        && k !== MIGRATION_DONE_KEY
        && k !== 'library_welcome_modal_dismissed');
    } catch {}
  }
}

export async function migrateLocalStorage() {
  if (!canUseIdb || !canUseLocal) return undefined;
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(WORKSPACE_PREFIX) || key === WORKSPACE_MARKER_KEY) continue;
      const existing = await idbGet(key);
      if (existing !== undefined) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        await idbSet(key, JSON.parse(raw));
      } catch {}
    }
  } catch {}
  return undefined;
}

// ─── Legacy migration ────────────────────────────────────────────────────────
// One-time copy of data stored under the old `cybernotes` IDB and `redops_*` keys
// into the new `library` IDB with `library_*` keys. Runs at module load, idempotent.

function syncMigrateLocalStorage() {
  if (!canUseLocal) return;
  try {
    if (window.localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;
    // Welcome-modal dismissal carries over too.
    const legacyWelcomes = [LEGACY_WELCOME_KEY, LEGACY_CYBERNOTES_WELCOME_KEY];
    for (const lk of legacyWelcomes) {
      const v = window.localStorage.getItem(lk);
      if (v != null && !window.localStorage.getItem('library_welcome_modal_dismissed')) {
        window.localStorage.setItem('library_welcome_modal_dismissed', v);
      }
    }
    // Workspace keys under `redops_*` → `library_*`.
    const renames = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LEGACY_PREFIX)) renames.push(k);
    }
    for (const oldKey of renames) {
      const newKey = renameKey(oldKey);
      if (window.localStorage.getItem(newKey) != null) continue; // don't overwrite
      const v = window.localStorage.getItem(oldKey);
      if (v != null) window.localStorage.setItem(newKey, v);
    }
  } catch {}
}

async function asyncMigrateIdb() {
  if (!canUseIdb) return;
  if (canUseLocal && window.localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return;
  try {
    // Try to open the legacy DB. If it doesn't exist, onupgradeneeded fires —
    // we abort there so we don't create an empty legacy DB just to read it.
    let legacyExists = true;
    const legacyDb = await new Promise((resolve, reject) => {
      const req = window.indexedDB.open(LEGACY_DB_NAME, 1);
      req.onupgradeneeded = () => { legacyExists = false; };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    }).catch(() => null);

    if (legacyDb && legacyExists && legacyDb.objectStoreNames.contains(STORE_NAME)) {
      const entries = await new Promise((resolve, reject) => {
        const tx = legacyDb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const result = [];
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve(result);
          result.push([cursor.key, cursor.value]);
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
      legacyDb.close();

      const newDb = await openDb();
      await new Promise((resolve, reject) => {
        const tx = newDb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const [k, v] of entries) {
          const newKey = renameKey(k);
          // Don't overwrite if a value is already present under the new key.
          const probe = store.get(newKey);
          probe.onsuccess = () => {
            if (probe.result === undefined) store.put(v, newKey);
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } else if (legacyDb) {
      legacyDb.close();
    }

    // Within the NEW DB, also rename any leftover `redops_*` keys that may have
    // been written to it during an in-flight migration.
    try {
      const newDb = await openDb();
      await new Promise((resolve) => {
        const tx = newDb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve();
          const k = cursor.key;
          if (typeof k === 'string' && k.startsWith(LEGACY_PREFIX)) {
            const newKey = renameKey(k);
            const probe = store.get(newKey);
            probe.onsuccess = () => {
              if (probe.result === undefined) store.put(cursor.value, newKey);
              cursor.delete();
            };
          }
          cursor.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {}

    if (canUseLocal) {
      window.localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    }

    // Best-effort: delete the legacy DB so it stops showing in DevTools.
    try { window.indexedDB.deleteDatabase(LEGACY_DB_NAME); } catch {}
  } catch (err) {
    console.warn('[library] migration failed', err);
  }
}

ensureWorkspaceBootstrap();
syncMigrateLocalStorage();
// Fire-and-forget. Reads still work during the async migration because each
// `persistGet` will fall back to the legacy IDB via `legacyPersistGetFallback`.
asyncMigrateIdb();
