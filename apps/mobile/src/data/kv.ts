// Armazenamento no navegador (IndexedDB). No iOS/Android nativo, o Metro usa kv.native.ts.
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
export interface StorageStatus { persisted: boolean | null; installed: boolean; kind: 'indexeddb' | 'securestore' }

const DB_NAME = 'stark';
const STORE = 'kv';

export function createIndexedDbStore(factory: IDBFactory | undefined = globalThis.indexedDB): KeyValueStore {
  let opening: Promise<IDBDatabase> | null = null;
  const open = () => opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (!factory) { reject(new Error('Este navegador não permite armazenamento local. Saia do modo privado ou use outro navegador.')); return; }
    const req = factory.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); opening = null; };
      resolve(db);
    };
    req.onerror = () => { opening = null; reject(new Error('Não foi possível abrir o armazenamento deste aparelho.')); };
    req.onblocked = () => { opening = null; reject(new Error('Feche outras abas do STARK e tente novamente.')); };
  });
  const run = async <T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
    const db = await open();
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = tx.onabort = () => reject(new Error(tx.error?.name === 'QuotaExceededError'
        ? 'O armazenamento deste aparelho está cheio.' : 'Não foi possível gravar neste aparelho.'));
    });
  };
  return {
    async get(key) { const v = await run<unknown>('readonly', s => s.get(key)); return typeof v === 'string' ? v : null; },
    async set(key, value) { await run('readwrite', s => { s.put(value, key); }); },
    async remove(key) { await run('readwrite', s => { s.delete(key); }); },
  };
}

export const store: KeyValueStore = createIndexedDbStore();

function installed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Pede ao navegador para não apagar os dados automaticamente. O navegador pode recusar. */
export async function requestPersistence(): Promise<StorageStatus> {
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  let persisted: boolean | null = null;
  try {
    if (s?.persisted) persisted = await s.persisted();
    if (persisted === false && s?.persist) persisted = await s.persist();
  } catch { persisted = null; }
  return { persisted, installed: installed(), kind: 'indexeddb' };
}
