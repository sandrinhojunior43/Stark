import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import type { Me, Preferences, Voice } from '@stark/contracts';
import { store, requestPersistence, type StorageStatus } from './kv';
import { createInitialState, newId, parseBackup, parseStored, serializeBackup, STATE_KEY, withPreferences, type LocalState } from './state';
import { ACCESS_KEY } from './access';
import { confirmAction, pickBackupFile, saveBackupFile } from './device';

type Value = {
  me: Me | null;
  preferences: Preferences | null;
  data: LocalState | null;
  /** Estado mais recente, inclusive de gravações ainda não renderizadas. */
  getData: () => LocalState | null;
  status: StorageStatus | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Dados salvos ilegíveis: o app não os sobrescreve sem confirmação. */
  unreadable: boolean;
  reload: () => Promise<void>;
  /** Aplica uma alteração e grava. Devolve a mensagem de erro, ou null se deu certo. As gravações entram numa fila. */
  mutate: (fn: (s: LocalState) => LocalState, fallback?: string) => Promise<string | null>;
  setPreferences: (patch: Partial<Preferences>) => Promise<void>;
  selectVoice: (voice: Voice) => Promise<void>;
  exportBackup: () => Promise<void>;
  importBackup: () => Promise<boolean>;
  eraseDevice: () => Promise<boolean>;
};
const Context = createContext<Value | null>(null);
const message = (e: unknown, fallback: string) => e instanceof Error && e.message ? e.message : fallback;

export function LocalStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<LocalState | null>(null);
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const current = useRef<LocalState | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const apply = (next: LocalState | null) => { current.current = next; setState(next); };

  // Uma gravação por vez, sempre sobre o estado mais recente: conversa, edições e preferências não se sobrescrevem.
  const run = <T,>(job: () => Promise<T>): Promise<T> => {
    pending.current++; setSaving(true);
    const p = chain.current.then(job);
    chain.current = p.catch(() => undefined);
    return p.finally(() => { pending.current--; if (pending.current === 0) setSaving(false); });
  };

  const reload = useCallback(async () => {
    setLoading(true); setError(null); setUnreadable(false);
    try {
      let next: LocalState | null;
      try { next = parseStored(await store.get(STATE_KEY)); }
      catch (e) { setUnreadable(true); throw e; }
      if (!next) { next = createInitialState(newId); await store.set(STATE_KEY, JSON.stringify(next)); }
      apply(next);
    } catch (e) { apply(null); setError(message(e, 'Não foi possível abrir seus dados.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void reload();
    requestPersistence().then(setStatus, () => {});
  }, [reload]);

  const mutate: Value['mutate'] = async (fn, fallback = 'Não foi possível salvar.') => {
    try {
      await run(async () => {
        const base = current.current;
        if (!base) throw new Error('Seus dados ainda não foram abertos.');
        const next = fn(base);
        if (next !== base) await store.set(STATE_KEY, JSON.stringify(next));
        apply(next);
      });
      return null;
    } catch (e) { return message(e, fallback); }
  };

  const setPreferences = async (patch: Partial<Preferences>) => {
    setError(null);
    const err = await mutate(s => {
      const keys = Object.keys(patch) as (keyof Preferences)[];
      return keys.every(k => s.me.preferences[k] === patch[k]) ? s : withPreferences(s, patch);
    }, 'Não foi possível salvar a preferência.');
    if (err) setError(err);
  };
  const selectVoice = (voice: Voice) => setPreferences({ voice });

  const exportBackup = async () => {
    const base = current.current;
    if (!base) return;
    setError(null);
    try { await saveBackupFile(`stark-backup-${new Date().toISOString().slice(0, 10)}.json`, serializeBackup(base)); }
    catch (e) { setError(message(e, 'Não foi possível exportar o backup.')); }
  };

  const replaceAll = async (next: LocalState, wipeAccess: boolean) => {
    await run(async () => {
      if (wipeAccess) await store.remove(ACCESS_KEY);
      await store.set(STATE_KEY, JSON.stringify(next));
      apply(next); setUnreadable(false);
    });
  };

  const importBackup = async () => {
    setError(null);
    try {
      const text = await pickBackupFile();
      if (text === null) return false;
      const next = parseBackup(text);
      if (!(await confirmAction('Restaurar backup?', 'Os dados atuais deste aparelho serão substituídos pelos do arquivo.', 'Restaurar'))) return false;
      await replaceAll(next, false);
      return true;
    } catch (e) { setError(message(e, 'Não foi possível restaurar o backup.')); return false; }
  };

  const eraseDevice = async () => {
    setError(null);
    try {
      if (!(await confirmAction('Apagar dados deste aparelho?',
        'Preferências, conversas, memórias, projetos, ideias, anotações e o código de acesso serão removidos. Exporte um backup antes se quiser guardá-los.', 'Apagar'))) return false;
      await replaceAll(createInitialState(newId), true);
      return true;
    } catch (e) { setError(message(e, 'Não foi possível apagar os dados.')); return false; }
  };

  return <Context.Provider value={{ me: state?.me ?? null, preferences: state?.me.preferences ?? null, data: state, getData: () => current.current,
    status, loading, saving, error, unreadable, reload, mutate, setPreferences, selectVoice, exportBackup, importBackup, eraseDevice }}>
    {children}
  </Context.Provider>;
}

export function useLocalState() {
  const value = useContext(Context);
  if (!value) throw new Error('LocalStateProvider ausente');
  return value;
}

/** Versão que não lança erro fora do provedor (usada por telas de erro, que podem renderizar sem ele). */
export function useLocalStateOptional() { return useContext(Context); }
