import * as SecureStore from 'expo-secure-store';
import { createChunkStorage } from '../lib/chunk-storage';
import type { KeyValueStore, StorageStatus } from './kv';
export type { KeyValueStore, StorageStatus } from './kv';

// Build nativo: armazenamento do sistema, em partes pequenas. Adequado ao estado atual;
// quando houver muito histórico, troque por SQLite mantendo esta mesma interface.
const chunks = createChunkStorage(SecureStore);
export const store: KeyValueStore = { get: k => chunks.getItem(k), set: (k, v) => chunks.setItem(k, v), remove: k => chunks.removeItem(k) };
export async function requestPersistence(): Promise<StorageStatus> { return { persisted: true, installed: true, kind: 'securestore' }; }
