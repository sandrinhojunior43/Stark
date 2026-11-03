import { store } from './kv';

/** Código de acesso à função de chat. Fica só neste aparelho e não entra no backup. */
export const ACCESS_KEY = 'stark.access.v1';
export const getAccessCode = async () => (await store.get(ACCESS_KEY)) ?? '';
export const setAccessCode = (value: string) => (value ? store.set(ACCESS_KEY, value) : store.remove(ACCESS_KEY));
