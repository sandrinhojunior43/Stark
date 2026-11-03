import { ASSISTANT_ID, DEFAULT_PREFERENCES, LIMITS, isIdeaStatus, isProjectStatus, isSpherePreset, isTheme, isVoice, isVolume,
  type Idea, type Me, type Note, type Preferences, type Project, type Voice } from '@stark/contracts';

/**
 * Estado único do STARK neste aparelho: uma identidade, um contexto, uma memória e um histórico.
 * Trocar a voz altera só `me.preferences.voice`.
 */
export interface Memory { id: string; text: string; createdAt: string }
export type Via = 'text' | 'voice';
export interface Message { id: string; role: 'user' | 'assistant'; text: string; via: Via; createdAt: string }
export interface LocalState {
  schema: 2;
  me: Me;
  memories: Memory[];
  messages: Message[];
  notes: Note[];
  projects: Project[];
  ideas: Idea[];
  createdAt: string;
  updatedAt: string;
}

export const STATE_KEY = 'stark.state.v1';
export const BACKUP_FORMAT = 'stark-backup';

export class StateError extends Error {}

export function createInitialState(newId: () => string, now: Date = new Date()): LocalState {
  const userId = newId();
  const at = now.toISOString();
  return {
    schema: 2,
    me: {
      userId, assistantId: ASSISTANT_ID, contextId: newId(),
      memoryScope: `memory:${userId}`, historyScope: `history:${userId}`,
      preferences: { ...DEFAULT_PREFERENCES },
    },
    memories: [], messages: [], notes: [], projects: [], ideas: [], createdAt: at, updatedAt: at,
  };
}

export function withVoice(state: LocalState, voice: Voice, now: Date = new Date()): LocalState {
  if (!isVoice(voice)) throw new StateError('Voz inválida.');
  return withPreferences(state, { voice }, now);
}

/** Altera preferências sem tocar em identidade, contexto, memória ou histórico. */
export function withPreferences(state: LocalState, patch: Partial<Preferences>, now: Date = new Date()): LocalState {
  const next = { ...state.me.preferences, ...patch };
  if (!isPreferences(next)) throw new StateError('Preferência inválida.');
  return { ...state, me: { ...state.me, preferences: next }, updatedAt: now.toISOString() };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const exactKeys = (o: Record<string, unknown>, keys: string[]) => {
  const own = Object.keys(o);
  return own.length === keys.length && keys.every(k => own.includes(k));
};
const list = <T,>(v: unknown, ok: (x: unknown) => x is T, max: number): v is T[] => Array.isArray(v) && v.length <= max && v.every(ok);

function isPreferences(p: unknown): p is Preferences {
  return isObject(p) && exactKeys(p, ['voice', 'theme', 'sphere', 'volume'])
    && isVoice(p.voice) && isTheme(p.theme) && isSpherePreset(p.sphere) && isVolume(p.volume);
}

function validMe(v: unknown): v is Me {
  if (!isObject(v) || !exactKeys(v, ['userId', 'assistantId', 'contextId', 'memoryScope', 'historyScope', 'preferences'])) return false;
  return isText(v.userId) && v.assistantId === ASSISTANT_ID && isText(v.contextId)
    && v.memoryScope === `memory:${v.userId}` && v.historyScope === `history:${v.userId}` && isPreferences(v.preferences);
}
const validMemory = (v: unknown): v is Memory =>
  isObject(v) && exactKeys(v, ['id', 'text', 'createdAt']) && isText(v.id) && isText(v.text, 20000) && isDate(v.createdAt);
const validMessage = (v: unknown): v is Message =>
  isObject(v) && exactKeys(v, ['id', 'role', 'text', 'via', 'createdAt']) && isText(v.id)
  && (v.role === 'user' || v.role === 'assistant') && isText(v.text, 20000) && (v.via === 'text' || v.via === 'voice') && isDate(v.createdAt);
const validNote = (v: unknown): v is Note =>
  isObject(v) && exactKeys(v, ['id', 'title', 'body', 'createdAt', 'updatedAt']) && isText(v.id)
  && isText(v.title, LIMITS.title) && isStr(v.body, LIMITS.body) && isDate(v.createdAt) && isDate(v.updatedAt);
const validIdea = (v: unknown): v is Idea =>
  isObject(v) && exactKeys(v, ['id', 'title', 'body', 'status', 'projectId', 'createdAt', 'updatedAt']) && isText(v.id)
  && isText(v.title, LIMITS.title) && isStr(v.body, LIMITS.body) && isIdeaStatus(v.status)
  && (v.projectId === null || isText(v.projectId)) && isDate(v.createdAt) && isDate(v.updatedAt);
const validStep = (v: unknown): v is Project['steps'][number] =>
  isObject(v) && exactKeys(v, ['id', 'text', 'done']) && isText(v.id) && isText(v.text, LIMITS.step) && typeof v.done === 'boolean';
const validDecision = (v: unknown): v is Project['decisions'][number] =>
  isObject(v) && exactKeys(v, ['id', 'text', 'createdAt']) && isText(v.id) && isText(v.text, LIMITS.decision) && isDate(v.createdAt);
const validProject = (v: unknown): v is Project =>
  isObject(v) && exactKeys(v, ['id', 'title', 'goal', 'status', 'steps', 'analysis', 'decisions', 'createdAt', 'updatedAt']) && isText(v.id)
  && isText(v.title, LIMITS.title) && isStr(v.goal, LIMITS.goal) && isProjectStatus(v.status)
  && list(v.steps, validStep, LIMITS.steps) && isStr(v.analysis, LIMITS.analysis) && list(v.decisions, validDecision, LIMITS.decisions)
  && isDate(v.createdAt) && isDate(v.updatedAt);

export function isLocalState(v: unknown): v is LocalState {
  return isObject(v) && exactKeys(v, ['schema', 'me', 'memories', 'messages', 'notes', 'projects', 'ideas', 'createdAt', 'updatedAt'])
    && v.schema === 2 && validMe(v.me)
    && list(v.memories, validMemory, 10000) && list(v.messages, validMessage, 100000)
    && list(v.notes, validNote, 100000) && list(v.projects, validProject, 100000) && list(v.ideas, validIdea, 100000)
    && isDate(v.createdAt) && isDate(v.updatedAt);
}

/** Dados de versões anteriores: só a voz nas preferências (v1) e sem notas/projetos/ideias (schema 1). */
function upgrade(v: unknown): unknown {
  if (!isObject(v)) return v;
  let out: Record<string, unknown> = v;
  if (isObject(out.me) && isObject(out.me.preferences) && exactKeys(out.me.preferences, ['voice'])) {
    out = { ...out, me: { ...out.me, preferences: { ...DEFAULT_PREFERENCES, voice: out.me.preferences.voice } } };
  }
  if (out.schema === 1 && Array.isArray(out.messages)) {
    out = { ...out, schema: 2, notes: [], projects: [], ideas: [], messages: out.messages.map(m => (isObject(m) ? { ...m, via: 'text' } : m)) };
  }
  return out;
}

/** Lê o valor salvo. `null` = nada salvo ainda; erro = dado ilegível (não é sobrescrito sem confirmação). */
export function parseStored(raw: string | null): LocalState | null {
  if (raw === null) return null;
  let value: unknown;
  try { value = upgrade(JSON.parse(raw)); } catch { throw new StateError('Os dados salvos neste aparelho estão ilegíveis.'); }
  if (!isLocalState(value)) throw new StateError('Os dados salvos neste aparelho estão em um formato desconhecido.');
  return value;
}

export function serializeBackup(state: LocalState, now: Date = new Date()): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), state }, null, 2);
}

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function parseBackup(text: string): LocalState {
  if (text.length > MAX_BACKUP_BYTES) throw new StateError('O arquivo é grande demais para ser um backup do STARK.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new StateError('O arquivo não é um backup válido do STARK.'); }
  if (!isObject(value) || value.format !== BACKUP_FORMAT) throw new StateError('O arquivo não é um backup do STARK.');
  if (value.version !== 1) throw new StateError('Este backup foi criado por uma versão diferente do STARK.');
  const state = upgrade(value.state);
  if (!isLocalState(state)) throw new StateError('O backup está incompleto ou foi alterado.');
  return state;
}

export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (!c?.getRandomValues) throw new StateError('Este aparelho não oferece um gerador aleatório seguro.');
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
