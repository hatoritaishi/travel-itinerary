const databaseName = 'travel-note-auth-v1';
const storeName = 'sessions';
const entryName = new URL('.', window.location.href).pathname;

function access(mode, action) {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('Storage unavailable')); return; }
    let db;
    let transaction;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error && transaction) { try { transaction.abort(); } catch {} }
      db?.close();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Storage timeout')), 3000);
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => finish(request.error || new Error('Storage unavailable'));
    request.onblocked = () => finish(new Error('Storage blocked'));
    request.onsuccess = () => {
      db = request.result;
      if (settled) { db.close(); return; }
      try {
        transaction = db.transaction(storeName, mode);
        const operation = action(transaction.objectStore(storeName), entryName);
        let result;
        operation.onsuccess = () => { result = operation.result; };
        transaction.oncomplete = () => finish(null, result);
        transaction.onabort = () => finish(transaction.error || new Error('Storage operation failed'));
        transaction.onerror = () => finish(transaction.error || new Error('Storage operation failed'));
      } catch (error) { finish(error); }
    };
  });
}

export const readRemembered = () => access('readonly', (store, name) => store.get(name));
export const forgetRemembered = () => access('readwrite', (store, name) => store.delete(name));
export const saveRemembered = (key, payload) => {
  if (key.extractable || key.type !== 'secret' || key.algorithm.name !== 'AES-GCM') {
    return Promise.reject(new Error('Invalid viewing key'));
  }
  return access('readwrite', (store, name) => store.put({
    key, salt: payload.salt, iterations: payload.iterations, version: payload.version,
  }, name));
};
