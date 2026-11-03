import { describe, it, expect } from 'vitest';
import { createInitialState, newId, parseBackup, parseStored, serializeBackup, withPreferences, withVoice, StateError } from '../src/data/state';

const fixed = () => { let n = 0; return () => `id-${++n}`; };

describe('estado único do assistente', () => {
  it('cria uma identidade com contexto e escopos próprios, voz Wells por padrão', () => {
    const s = createInitialState(fixed(), new Date('2026-11-03T12:00:00Z'));
    expect(s.me).toEqual({ userId: 'id-1', assistantId: 'stark', contextId: 'id-2', memoryScope: 'memory:id-1', historyScope: 'history:id-1', preferences: { voice: 'wells', theme: 'dark', sphere: 'aurora', volume: 80 } });
  });

  it('Wells → Stark → Wells preserva identidade, contexto, memória e histórico', () => {
    const base = createInitialState(fixed());
    base.memories.push({ id: 'm1', text: 'gosta de café', createdAt: '2026-11-03T12:00:00Z' });
    base.messages.push({ id: 'h1', role: 'user', text: 'olá', via: 'text', createdAt: '2026-11-03T12:00:00Z' });
    const back = withVoice(withVoice(base, 'stark'), 'wells');
    const stark = withVoice(base, 'stark');
    expect(stark.me.preferences.voice).toBe('stark');
    for (const s of [stark, back]) {
      const { preferences: _p, ...id } = s.me; const { preferences: _q, ...orig } = base.me;
      expect(id).toEqual(orig);
      expect(s.memories).toEqual(base.memories);
      expect(s.messages).toEqual(base.messages);
    }
    expect(base.me.preferences.voice).toBe('wells');
  });

  it('rejeita voz inválida', () => {
    expect(() => withVoice(createInitialState(fixed()), 'jarvis' as never)).toThrow(StateError);
  });

  it('gera ids aleatórios distintos', () => {
    expect(newId()).not.toBe(newId());
  });
});

describe('armazenamento', () => {
  it('nada salvo retorna null; dado ilegível gera erro em vez de ser descartado', () => {
    expect(parseStored(null)).toBeNull();
    expect(() => parseStored('{oops')).toThrow(StateError);
    expect(() => parseStored(JSON.stringify({ schema: 2 }))).toThrow(StateError);
  });
  it('relê o que foi gravado', () => {
    const s = withVoice(createInitialState(fixed()), 'stark');
    expect(parseStored(JSON.stringify(s))).toEqual(s);
  });
});

describe('backup', () => {
  it('ida e volta preserva tudo', () => {
    const s = withVoice(createInitialState(fixed()), 'stark');
    expect(parseBackup(serializeBackup(s))).toEqual(s);
  });
  it('rejeita arquivos que não são backup, versões desconhecidas e campos extras ou alterados', () => {
    const s = createInitialState(fixed());
    const wrap = (state: unknown, extra: object = {}) => JSON.stringify({ format: 'stark-backup', version: 1, exportedAt: 'x', state, ...extra });
    expect(() => parseBackup('não é json')).toThrow('não é um backup válido');
    expect(() => parseBackup(JSON.stringify({ a: 1 }))).toThrow('não é um backup');
    expect(() => parseBackup(wrap(s, { version: 9 }))).toThrow('versão diferente');
    expect(() => parseBackup(wrap({ ...s, admin: true }))).toThrow('incompleto');
    expect(() => parseBackup(wrap({ ...s, me: { ...s.me, memoryScope: 'memory:outro' } }))).toThrow('incompleto');
    expect(() => parseBackup(wrap({ ...s, me: { ...s.me, preferences: { ...s.me.preferences, voice: 'outra' } } }))).toThrow('incompleto');
    expect(() => parseBackup(wrap({ ...s, messages: [{ id: 'x', role: 'system', text: 'oi', via: 'text', createdAt: '2026-11-03T12:00:00Z' }] }))).toThrow('incompleto');
  });
});

describe('preferências de aparência', () => {
  it('tema, cores e volume não alteram identidade, contexto, memória nem histórico', () => {
    const base = createInitialState(fixed());
    base.memories.push({ id: 'm1', text: 'x', createdAt: '2026-11-03T12:00:00Z' });
    const next = withPreferences(base, { theme: 'light', sphere: 'oceano', volume: 35 });
    expect(next.me.preferences).toEqual({ voice: 'wells', theme: 'light', sphere: 'oceano', volume: 35 });
    expect({ ...next.me, preferences: 0 }).toEqual({ ...base.me, preferences: 0 });
    expect(next.memories).toEqual(base.memories);
  });
  it('rejeita valores inválidos', () => {
    const base = createInitialState(fixed());
    for (const patch of [{ volume: 101 }, { volume: -1 }, { volume: 12.5 }, { theme: 'sepia' }, { sphere: 'neon' }, { voice: 'x' }])
      expect(() => withPreferences(base, patch as never)).toThrow(StateError);
  });
  it('dados e backups da versão anterior (só com a voz) são completados com os padrões', () => {
    const s = createInitialState(fixed());
    const legacy = { ...s, me: { ...s.me, preferences: { voice: 'stark' } } };
    const expected = { ...s, me: { ...s.me, preferences: { voice: 'stark', theme: 'dark', sphere: 'aurora', volume: 80 } } };
    expect(parseStored(JSON.stringify(legacy))).toEqual(expected);
    expect(parseBackup(JSON.stringify({ format: 'stark-backup', version: 1, exportedAt: 'x', state: legacy }))).toEqual(expected);
  });
  it('legado com voz inválida continua sendo recusado', () => {
    const s = createInitialState(fixed());
    expect(() => parseStored(JSON.stringify({ ...s, me: { ...s.me, preferences: { voice: 'x' } } }))).toThrow(StateError);
  });
});

describe('migração do formato antigo (schema 1)', () => {
  it('completa notas, projetos, ideias e o canal das mensagens', () => {
    const s = createInitialState(fixed());
    const { notes: _n, projects: _p, ideas: _i, ...rest } = s;
    const legacy = { ...rest, schema: 1, messages: [{ id: 'm', role: 'user', text: 'oi', createdAt: '2026-11-03T12:00:00Z' }] };
    const up = parseStored(JSON.stringify(legacy))!;
    expect(up.schema).toBe(2);
    expect(up.notes).toEqual([]); expect(up.projects).toEqual([]); expect(up.ideas).toEqual([]);
    expect(up.messages[0]!.via).toBe('text');
    expect(parseBackup(JSON.stringify({ format: 'stark-backup', version: 1, exportedAt: 'x', state: legacy })).schema).toBe(2);
  });
  it('recusa projeto adulterado dentro de um backup', () => {
    const s = createInitialState(fixed());
    const bad = { ...s, projects: [{ id: 'p', title: 'x', goal: '', status: 'inventado', steps: [], analysis: '', decisions: [], createdAt: s.createdAt, updatedAt: s.createdAt }] };
    expect(() => parseBackup(JSON.stringify({ format: 'stark-backup', version: 1, exportedAt: 'x', state: bad }))).toThrow('incompleto');
  });
});
