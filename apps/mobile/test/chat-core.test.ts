import { describe, it, expect } from 'vitest';
import { createChatHandler, DEFAULT_MODEL, readModelContent, SYSTEM_PROMPT, type ChatEnv } from '../../../api/_lib/chat-core';
import { ACCESS_HEADER } from '@stark/contracts';

const ENV: ChatEnv = { ANTHROPIC_API_KEY: 'sk-test-secret', STARK_ACCESS_CODE: 'segredo-123' };
const ctx = { projects: [{ id: 'p1', title: 'App', status: 'andamento', goal: 'Meta' }], ideas: [{ id: 'i1', title: 'Ideia', status: 'nova', projectId: null }], notes: [{ id: 'n1', title: 'Nota' }], memories: ['Prefere respostas curtas'], focus: '' };
const body = (over: object = {}) => JSON.stringify({ messages: [{ role: 'user', text: 'Oi' }], context: ctx, ...over });
const req = (init: { method?: string; code?: string | null; body?: string; ip?: string } = {}) => new Request('https://stark.test/api/chat', {
  method: init.method ?? 'POST', body: init.method === 'GET' ? undefined : (init.body ?? body()),
  headers: { 'content-type': 'application/json', 'x-forwarded-for': init.ip ?? '1.1.1.1', ...(init.code === null ? {} : { [ACCESS_HEADER]: init.code ?? 'segredo-123' }) },
});
const upstream = (content: unknown, status = 200) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ content }), { status }); }) as unknown as typeof fetch;
  return { calls, fetchFn };
};
const ok = [{ type: 'text', text: 'Olá, tudo bem?' }];

describe('autenticação e configuração', () => {
  it('sem chave ou sem código no servidor: 503 e nenhuma chamada externa', async () => {
    const u = upstream(ok); const h = createChatHandler({ fetchFn: u.fetchFn });
    expect((await h(req(), {})).status).toBe(503);
    expect((await h(req(), { ANTHROPIC_API_KEY: 'x' })).status).toBe(503);
    expect(u.calls).toHaveLength(0);
  });
  it('código ausente ou errado: 401 e nenhuma chamada externa', async () => {
    const u = upstream(ok); const h = createChatHandler({ fetchFn: u.fetchFn });
    expect((await h(req({ code: null }), ENV)).status).toBe(401);
    expect((await h(req({ code: 'errado' }), ENV)).status).toBe(401);
    expect(u.calls).toHaveLength(0);
  });
  it('bloqueia o IP depois de 8 tentativas erradas, mesmo que a próxima esteja certa', async () => {
    const u = upstream(ok); const h = createChatHandler({ fetchFn: u.fetchFn });
    for (let i = 0; i < 8; i++) await h(req({ code: 'x' + i, ip: '9.9.9.9' }), ENV);
    const r = await h(req({ ip: '9.9.9.9' }), ENV);
    expect(r.status).toBe(429); expect((await r.json()).error.code).toBe('TOO_MANY_ATTEMPTS');
    expect((await h(req({ ip: '8.8.8.8' }), ENV)).status).toBe(200);
  });
  it('limita 30 mensagens por minuto por IP, e libera depois', async () => {
    let t = 0; const u = upstream(ok); const h = createChatHandler({ fetchFn: u.fetchFn, now: () => t });
    for (let i = 0; i < 30; i++) expect((await h(req(), ENV)).status).toBe(200);
    expect((await h(req(), ENV)).status).toBe(429);
    t = 61_000;
    expect((await h(req(), ENV)).status).toBe(200);
  });
  it('GET informa a configuração sem revelar segredos', async () => {
    const h = createChatHandler();
    const r = await h(req({ method: 'GET', code: null }), ENV); const j = await r.json();
    expect(j).toEqual({ configured: { apiKey: true, accessCode: true }, model: DEFAULT_MODEL, authorized: null });
    expect(JSON.stringify(j)).not.toContain('sk-test-secret'); expect(JSON.stringify(j)).not.toContain('segredo-123');
    expect((await (await h(req({ method: 'GET' }), ENV)).json()).authorized).toBe(true);
    expect((await (await h(req({ method: 'GET', code: 'nope' }), ENV)).json()).authorized).toBe(false);
    expect((await (await h(req({ method: 'GET', code: null }), {})).json()).configured).toEqual({ apiKey: false, accessCode: false });
  });
  it('outros métodos: 405', async () => {
    expect((await createChatHandler()(req({ method: 'DELETE' }), ENV)).status).toBe(405);
  });
});

describe('pedido ao modelo', () => {
  it('envia chave, modelo, persona, ferramentas e contexto; nunca a voz', async () => {
    const u = upstream(ok); const h = createChatHandler({ fetchFn: u.fetchFn });
    const r = await h(req({ body: body({ voice: 'stark', preferences: { voice: 'wells' } }) }), { ...ENV, STARK_MODEL: 'meu-modelo' });
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ text: 'Olá, tudo bem?', proposals: [], remembered: [] });
    const call = u.calls[0]!;
    expect(call.url).toBe('https://api.anthropic.com/v1/messages');
    const headers = call.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test-secret'); expect(headers['anthropic-version']).toBe('2023-06-01');
    const sent = JSON.parse(call.init.body as string);
    expect(sent.model).toBe('meu-modelo');
    expect(sent.system).toContain(SYSTEM_PROMPT.slice(0, 40)); expect(sent.system).toContain('[p1] App (andamento): Meta'); expect(sent.system).toContain('Prefere respostas curtas');
    expect(sent.tools.map((t: { name: string }) => t.name)).toEqual(['propose_idea', 'propose_project', 'propose_note', 'propose_decision', 'remember']);
    expect(sent.messages).toEqual([{ role: 'user', content: 'Oi' }]);
    expect(call.init.body).not.toMatch(/stark"|wells|voice/i);
  });
  it('inclui o item em discussão e descarta mensagens iniciais do assistente', async () => {
    const u = upstream(ok); const h = createChatHandler({ fetchFn: u.fetchFn });
    await h(req({ body: JSON.stringify({ messages: [{ role: 'assistant', text: 'sobra' }, { role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }, { role: 'user', text: 'c' }], context: { ...ctx, focus: 'Projeto "App" — riscos: prazo' } }) }), ENV);
    const sent = JSON.parse(u.calls[0]!.init.body as string);
    expect(sent.system).toContain('Em discussão agora'); expect(sent.system).toContain('riscos: prazo');
    expect(sent.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
  });
  it('valida o corpo', async () => {
    const h = createChatHandler({ fetchFn: upstream(ok).fetchFn });
    for (const b of ['não json', JSON.stringify({}), JSON.stringify({ messages: [] }), JSON.stringify({ messages: [{ role: 'user', text: '  ' }] }),
      JSON.stringify({ messages: [{ role: 'system', text: 'x' }] }), JSON.stringify({ messages: [{ role: 'user', text: 'x' }, { role: 'assistant', text: 'y' }] }),
      JSON.stringify({ messages: [{ role: 'user', text: 'x'.repeat(8001) }] }), JSON.stringify({ messages: Array(41).fill({ role: 'user', text: 'x' }) })])
      expect((await h(req({ body: b }), ENV)).status).toBe(400);
    expect((await h(req({ body: 'x'.repeat(200_001) }), ENV)).status).toBe(413);
  });
});

describe('respostas do modelo', () => {
  it('converte ferramentas em sugestões e memórias', () => {
    const out = readModelContent([
      { type: 'text', text: 'Boa ideia.' },
      { type: 'tool_use', name: 'propose_idea', input: { title: ' Resumo semanal ', body: 'Gravar e resumir' } },
      { type: 'tool_use', name: 'propose_project', input: { title: 'App pessoal', goal: 'Organizar a vida' } },
      { type: 'tool_use', name: 'propose_note', input: { title: 'Reflexão', body: 'texto' } },
      { type: 'tool_use', name: 'propose_decision', input: { projectId: 'p1', text: 'Usar PWA' } },
      { type: 'tool_use', name: 'remember', input: { fact: 'Prefere respostas curtas' } },
    ], new Set(['p1']));
    expect(out.text).toBe('Boa ideia.');
    expect(out.proposals).toEqual([
      { kind: 'idea', title: 'Resumo semanal', body: 'Gravar e resumir', projectId: null },
      { kind: 'project', title: 'App pessoal', body: 'Organizar a vida', projectId: null },
      { kind: 'note', title: 'Reflexão', body: 'texto', projectId: null },
      { kind: 'decision', title: '', body: 'Usar PWA', projectId: 'p1' },
    ]);
    expect(out.remembered).toEqual(['Prefere respostas curtas']);
  });
  it('descarta decisão de projeto desconhecido, ferramentas inválidas e limita a quantidade', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ type: 'tool_use', name: 'propose_idea', input: { title: 'i' + i, body: '' } }));
    const out = readModelContent([{ type: 'text', text: 'x' }, { type: 'tool_use', name: 'propose_decision', input: { projectId: 'fantasma', text: 'x' } },
      { type: 'tool_use', name: 'apagar_tudo', input: { x: 1 } }, { type: 'tool_use', name: 'propose_idea', input: { title: '', body: 'sem título' } }, ...many], new Set(['p1']));
    expect(out.proposals).toHaveLength(5); expect(out.proposals.every(p => p.kind === 'idea' && p.title.startsWith('i'))).toBe(true);
  });
  it('texto de reserva quando só há ferramenta; erro quando não há nada', async () => {
    expect(readModelContent([{ type: 'tool_use', name: 'propose_idea', input: { title: 'T', body: '' } }], new Set()).text).toBe('Preparei uma sugestão para você.');
    expect(readModelContent([{ type: 'tool_use', name: 'remember', input: { fact: 'f' } }], new Set()).text).toBe('Anotado.');
    const h = createChatHandler({ fetchFn: upstream([]).fetchFn });
    expect((await h(req(), ENV)).status).toBe(502);
  });
});

describe('falhas do serviço de IA', () => {
  it('traduz erros sem vazar detalhes da chave', async () => {
    const cases: [number, number, string][] = [[401, 502, 'UPSTREAM_AUTH'], [403, 502, 'UPSTREAM_AUTH'], [429, 429, 'UPSTREAM_RATE'], [400, 502, 'UPSTREAM_BAD'], [404, 502, 'UPSTREAM_BAD'], [500, 502, 'UPSTREAM_DOWN'], [529, 502, 'UPSTREAM_DOWN']];
    for (const [up, status, code] of cases) {
      const r = await createChatHandler({ fetchFn: upstream([], up).fetchFn })(req(), ENV); const j = await r.json();
      expect([r.status, j.error.code]).toEqual([status, code]); expect(JSON.stringify(j)).not.toContain('sk-test-secret');
    }
  });
  it('falha de rede e tempo esgotado', async () => {
    const boom = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    expect((await createChatHandler({ fetchFn: boom })(req(), ENV)).status).toBe(502);
    const aborted = (async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; }) as unknown as typeof fetch;
    expect((await (await createChatHandler({ fetchFn: aborted })(req(), ENV)).json()).error.code).toBe('TIMEOUT');
  });
});
