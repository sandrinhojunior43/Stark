import { it, expect } from 'vitest';
import { createChunkStorage } from '../src/lib/chunk-storage';
const driver = (entries: Map<string, string>, failOn?: () => boolean) => ({
  async getItemAsync(key: string) { return entries.get(key) ?? null; },
  async setItemAsync(key: string, value: string) { if (failOn?.() && key.endsWith('.1')) throw new Error('disk'); entries.set(key, value); },
  async deleteItemAsync(key: string) { entries.delete(key); },
});
it('nativo: persiste valor longo em partes e remove todas', async () => {
  const entries = new Map<string, string>();
  const storage = createChunkStorage(driver(entries));
  const long = 'dado'.repeat(1000);
  await storage.setItem('s', long);
  expect(await storage.getItem('s')).toBe(long);
  await storage.setItem('s', 'curto');
  expect(await storage.getItem('s')).toBe('curto');
  expect(entries.size).toBe(2);
  await storage.removeItem('s');
  expect(entries.size).toBe(0);
});
it('nativo: falha ao gravar não substitui o valor anterior', async () => {
  const entries = new Map<string, string>();
  let fail = false;
  const storage = createChunkStorage(driver(entries, () => fail));
  await storage.setItem('s', 'antigo'); fail = true;
  await expect(storage.setItem('s', 'x'.repeat(1000))).rejects.toThrow();
  expect(await storage.getItem('s')).toBe('antigo');
});
