import { it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createIndexedDbStore } from '../src/data/kv';

it('grava, relê e remove no IndexedDB, e os dados sobrevivem a reabrir', async () => {
  const factory = new IDBFactory();
  const a = createIndexedDbStore(factory);
  expect(await a.get('k')).toBeNull();
  await a.set('k', 'x'.repeat(200_000));
  const b = createIndexedDbStore(factory);
  expect(await b.get('k')).toHaveLength(200_000);
  await b.set('k', 'novo');
  expect(await a.get('k')).toBe('novo');
  await a.remove('k');
  expect(await b.get('k')).toBeNull();
});

it('sem IndexedDB, explica o problema em vez de fingir que salvou', async () => {
  const s = createIndexedDbStore(undefined);
  await expect(s.set('k', 'v')).rejects.toThrow('não permite armazenamento local');
});
