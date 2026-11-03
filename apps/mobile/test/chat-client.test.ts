import { describe, it, expect } from 'vitest';
import { ACCESS_HEADER } from '@stark/contracts';
import { ChatError, getStatus, postChat } from '../src/chat/client';
import { buildContext, buildMessages } from '../src/chat/context';
import { speechText, splitSentences } from '../src/chat/text';
import { formatWhen, formatDay, matches } from '../src/ui/format';
import { addDecision, addIdea, addMemory, addNote, addProject, appendMessages } from '../src/data/actions';
import { createInitialState } from '../src/data/state';

const reply = (status: number, body: unknown) => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
const REQ = { messages: [{ role: 'user' as const, text: 'oi' }], context: { projects: [], ideas: [], notes: [], memories: [], focus: '' } };

describe('cliente do chat', () => {
  it('envia o código no cabeçalho e devolve a resposta', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ text: 'ok', proposals: [], remembered: [] })); }) as unknown as typeof fetch;
    expect(await postChat(REQ, 'meu-codigo', undefined, f)).toEqual({ text: 'ok', proposals: [], remembered: [] });
    expect(seen!.url).toBe('/api/chat'); expect((seen!.init.headers as Record<string, string>)[ACCESS_HEADER]).toBe('meu-codigo');
  });
  it('mostra a mensagem do servidor e traduz falhas de rede, 404 e HTML', async () => {
    const e1 = await postChat(REQ, 'x', undefined, reply(401, { error: { code: 'UNAUTHORIZED', message: 'Código de acesso incorreto.' } })).catch(e => e);
    expect(e1).toBeInstanceOf(ChatError); expect([e1.code, e1.message]).toEqual(['UNAUTHORIZED', 'Código de acesso incorreto.']);
    expect((await postChat(REQ, 'x', undefined, reply(404, '<html>')).catch(e => e)).message).toContain('não está publicado');
    expect((await postChat(REQ, 'x', undefined, reply(200, '<html>')).catch(e => e)).code).toBe('NOT_FOUND');
    const down = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect((await postChat(REQ, 'x', undefined, down).catch(e => e)).code).toBe('NETWORK');
  });
  it('cancelar não vira erro de rede', async () => {
    const c = new AbortController();
    const f = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))))) as unknown as typeof fetch;
    const p = postChat(REQ, 'x', c.signal, f).catch(e => e); c.abort();
    expect((await p).code).toBe('ABORTED');
  });
  it('status da configuração', async () => {
    const st = { configured: { apiKey: true, accessCode: true }, model: 'm', authorized: true };
    expect(await getStatus('c', reply(200, st))).toEqual(st);
  });
});

describe('contexto enviado ao modelo', () => {
  const build = () => {
    let s = createInitialState(() => Math.random().toString(36).slice(2));
    s = addProject(s, { title: 'App pessoal', goal: 'Organizar', steps: ['Protótipo'], analysis: 'Risco: tempo' }, { id: 'p1' });
    s = addDecision(s, 'p1', 'Usar PWA');
    s = addIdea(s, { title: 'Resumo', body: 'texto da ideia', projectId: 'p1' }, { id: 'i1' });
    s = addNote(s, { title: 'Reflexão', body: 'corpo da nota' }, { id: 'n1' });
    s = addMemory(s, 'Prefere respostas curtas');
    return s;
  };
  it('resume projetos, ideias, notas e memórias, sem a voz', () => {
    const c = buildContext(build(), null);
    expect(c.projects[0]).toMatchObject({ id: 'p1', title: 'App pessoal', status: 'planejando' });
    expect(c.ideas[0]).toMatchObject({ id: 'i1', projectId: 'p1' }); expect(c.notes[0]).toMatchObject({ id: 'n1' });
    expect(c.memories).toEqual(['Prefere respostas curtas']); expect(c.focus).toBe('');
    expect(JSON.stringify(c)).not.toMatch(/wells|voice|stark/i);
  });
  it('detalha o item em foco', () => {
    const s = build();
    const p = buildContext(s, { kind: 'project', id: 'p1' }).focus;
    for (const t of ['App pessoal', 'Objetivo: Organizar', '[ ] Protótipo', 'Risco: tempo', 'Usar PWA', 'Resumo']) expect(p).toContain(t);
    expect(buildContext(s, { kind: 'idea', id: 'i1' }).focus).toContain('Ligada ao projeto "App pessoal"');
    expect(buildContext(s, { kind: 'note', id: 'n1' }).focus).toContain('corpo da nota');
    expect(buildContext(s, { kind: 'idea', id: 'inexistente' }).focus).toBe('');
  });
  it('envia só as últimas mensagens', () => {
    let s = createInitialState(() => 'x');
    for (let i = 0; i < 30; i++) s = appendMessages(s, [{ role: i % 2 ? 'assistant' : 'user', text: `m${i}`, via: 'text' }]);
    const m = buildMessages(s, 20); expect(m).toHaveLength(20); expect(m[19]!.text).toBe('m29');
  });
});

describe('texto para fala', () => {
  it('remove markdown, links e código', () => {
    expect(speechText('# Título\n**Negrito** e _itálico_ com `código` e [link](http://x.com) https://y.com\n- item um\n- item dois')).toBe('Título Negrito e itálico com código e link item um item dois');
    expect(speechText('antes ```js\nconst a=1\n``` depois')).toBe('antes depois');
  });
  it('divide em frases curtas sem perder texto', () => {
    expect(splitSentences('Olá. Tudo bem? Sim!')).toEqual(['Olá.', 'Tudo bem?', 'Sim!']);
    const long = 'palavra '.repeat(60).trim() + '.';
    const parts = splitSentences(long, 100);
    expect(parts.every(p => p.length <= 101)).toBe(true); expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(long);
    expect(splitSentences('')).toEqual([]);
  });
});

describe('formatação', () => {
  const now = new Date(2026, 10, 3, 15, 0);
  it('hoje, ontem e datas', () => {
    expect(formatWhen(new Date(2026, 10, 3, 14, 32).toISOString(), now)).toBe('Hoje, 14:32');
    expect(formatWhen(new Date(2026, 10, 2, 20, 15).toISOString(), now)).toBe('Ontem, 20:15');
    expect(formatWhen(new Date(2026, 9, 28, 9, 40).toISOString(), now)).toBe('28 de out., 09:40');
    expect(formatWhen(new Date(2025, 11, 1, 8, 5).toISOString(), now)).toBe('1 de dez. de 2025, 08:05');
    expect([formatDay(new Date(2026, 10, 3).toISOString(), now), formatDay(new Date(2026, 10, 2).toISOString(), now)]).toEqual(['Hoje', 'Ontem']);
  });
  it('busca sem diferenciar caixa e vazia mostra tudo', () => {
    expect(matches('PROJ', 'Meu projeto', 'x')).toBe(true); expect(matches('  ', 'a')).toBe(true); expect(matches('zzz', 'a', 'b')).toBe(false);
  });
});
