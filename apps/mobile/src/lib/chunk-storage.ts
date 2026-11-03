export interface StorageDriver {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}
// Divide valores grandes em partes: o armazenamento seguro de alguns aparelhos iOS limita o tamanho por item.
export function createChunkStorage(driver: StorageDriver) {
  const manifest = async (key: string): Promise<{ version: string; count: number } | null> => {
    const raw = await driver.getItemAsync(key);
    return raw ? JSON.parse(raw) : null;
  };
  const clean = async (key: string, old: { version: string; count: number } | null) => {
    if (old) await Promise.all(Array.from({ length: old.count }, (_, i) => driver.deleteItemAsync(`${key}.${old.version}.${i}`)));
  };
  return {
    async getItem(key: string) {
      const current = await manifest(key);
      if (!current) return null;
      const parts = await Promise.all(Array.from({ length: current.count }, (_, i) => driver.getItemAsync(`${key}.${current.version}.${i}`)));
      return parts.some(part => part === null) ? null : parts.join('');
    },
    async setItem(key: string, value: string) {
      const old = await manifest(key);
      const version = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const chunks = value.match(/[\s\S]{1,500}/g) ?? [''];
      try {
        for (const [i, chunk] of chunks.entries()) await driver.setItemAsync(`${key}.${version}.${i}`, chunk);
        await driver.setItemAsync(key, JSON.stringify({ version, count: chunks.length }));
      } catch (error) {
        await clean(key, { version, count: chunks.length }).catch(() => {});
        throw error;
      }
      await clean(key, old);
    },
    async removeItem(key: string) {
      const old = await manifest(key);
      await driver.deleteItemAsync(key);
      await clean(key, old);
    },
  };
}
