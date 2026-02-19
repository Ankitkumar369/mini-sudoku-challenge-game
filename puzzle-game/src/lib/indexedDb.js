const DB_NAME = "daily-puzzle-logic";
const DB_VERSION = 1;
const KV_STORE = "kv";

let dbPromise;

function openDatabase() {
  if (!dbPromise) {
    // Open once and cache the promise to avoid duplicate open calls.
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        // Single key-value store keeps local storage API simple.
        if (!database.objectStoreNames.contains(KV_STORE)) {
          database.createObjectStore(KV_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
  }

  return dbPromise;
}

async function runTransaction(mode, operation) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(KV_STORE, mode);
    const store = transaction.objectStore(KV_STORE);

    operation(store, resolve, reject);

    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
  });
}

export async function getValue(key) {
  return runTransaction("readonly", (store, resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
  });
}

export async function setValue(key, value) {
  return runTransaction("readwrite", (store, resolve, reject) => {
    const request = store.put(value, key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("IndexedDB write failed"));
  });
}

export async function deleteValue(key) {
  return runTransaction("readwrite", (store, resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("IndexedDB delete failed"));
  });
}

export async function clearValues() {
  return runTransaction("readwrite", (store, resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("IndexedDB clear failed"));
  });
}
