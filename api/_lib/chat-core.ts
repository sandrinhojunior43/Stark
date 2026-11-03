import { ACCESS_HEADER, CHAT_LIMITS, type ChatMessage, type ChatResponse, type ChatStatus, type ProposalDraft } from '../../packages/contracts/src/chat';

/**
 * Função de chat do STARK. Sem estado: não guarda conversa, memória nem histórico.
 * Recebe do aparelho a conversa e um resumo dos dados, chama o modelo e devolve texto + sugestões.
 * A chave do modelo e o código de acesso existem só como variáveis de ambiente do servidor.
 */
export interface ChatEnv { ANTHROPIC_API_KEY?: string; STARK_ACCESS_CODE?: string; STARK_MODEL?: string; ANTHROPIC_API_URL?: string }
export interface HandlerOptions { fetchFn?: typeof fetch; now?: () => number }

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_BODY = 200_000;
const UPSTREAM_TIMEOUT_MS = 55_000;

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
const fail = (status: number, code: string, message: string, extra?: Record<string, string>) => json(status, { error: { code, message } }, extra);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const SYSTEM_PROMPT = `Você é o STARK, assistente pessoal de uma única pessoa. Responda sempre em português do Brasil.

Personalidade: sereno, inteligente, perspicaz, encorajador, articulado, levemente irônico e intelectualmente exigente. Conforme o contexto, atue como mentor (assuntos de vida), conselheiro (quando a pessoa pedir), parceiro intelectual (projetos, dúvidas, assistência técnica) e assistente executivo pontual.

Postura: não concorde automaticamente. Questione premissas, aponte inconsistências e riscos com respeito, e diga quando algo não fecha. Seja objetivo, sem enrolação nem elogios vazios. Quando uma ideia for boa, diga por quê; quando for fraca, diga o que falta.

Formato: suas respostas podem ser lidas em voz alta. Escreva em texto corrido, sem markdown, sem listas com marcadores, sem emojis. Prefira respostas curtas (2 a 6 frases) e só se alongue quando a pessoa pedir ou o assunto exigir. Faça no máximo uma pergunta por vez.

Dados da pessoa: o bloco "Contexto" lista projetos, ideias, anotações e memórias salvos no aparelho dela. Use-os quando forem relevantes e não invente itens que não estejam lá. Se algo não estiver no contexto, diga que não encontrou.

Ferramentas: elas só criam SUGESTÕES que a pessoa confirma depois; nunca diga que algo já foi salvo, diga que preparou a sugestão. Sempre escreva uma frase de texto junto com a ferramenta. Use propose_idea, propose_project ou propose_note somente quando surgir algo que valha guardar, sem insistir. Use propose_decision só para um projeto listado no contexto (informe o id). Use remember, que salva automaticamente e pode ser apagado pela pessoa, apenas para fatos duráveis e úteis sobre ela, como preferências, metas e restrições; nunca para dados sensíveis (saúde, finanças, documentos, senhas).

Você não sabe qual voz está sendo usada para falar, e isso não muda quem você é.`;

const TOOLS = [
  { name: 'propose_idea', description: 'Sugere salvar uma ideia da pessoa. Ela confirma antes de salvar.',
    input_schema: { type: 'object', properties: { title: { type: 'string', description: 'Título curto (até 120 caracteres).' }, body: { type: 'string', description: 'Descrição da ideia (até 2000 caracteres).' } }, required: ['title', 'body'] } },
  { name: 'propose_project', description: 'Sugere criar um projeto. Ela confirma antes de criar.',
    input_schema: { type: 'object', properties: { title: { type: 'string', description: 'Nome do projeto (até 120 caracteres).' }, goal: { type: 'string', description: 'Objetivo do projeto (até 2000 caracteres).' } }, required: ['title', 'goal'] } },
  { name: 'propose_note', description: 'Sugere salvar uma anotação no diário. Ela confirma antes de salvar.',
    input_schema: { type: 'object', properties: { title: { type: 'string', description: 'Título curto.' }, body: { type: 'string', description: 'Texto da anotação (até 4000 caracteres).' } }, required: ['title', 'body'] } },
  { name: 'propose_decision', description: 'Sugere registrar uma decisão em um projeto existente do contexto. Ela confirma antes de salvar.',
    input_schema: { type: 'object', properties: { projectId: { type: 'string', description: 'Id do projeto, exatamente como aparece no contexto.' }, text: { type: 'string', description: 'A decisão tomada (até 1000 caracteres).' } }, required: ['projectId', 'text'] } },
  { name: 'remember', description: 'Guarda um fato durável sobre a pessoa na memória. Salvo automaticamente; ela pode apagar depois.',
    input_schema: { type: 'object', properties: { fact: { type: 'string', description: 'Um fato curto e autoexplicativo (até 300 caracteres).' } }, required: ['fact'] } },
];

interface Ctx {
  projects: { id: string; title: string; status: string; goal: string }[];
  ideas: { id: string; title: string; status: string; projectId: string | null }[];
  notes: { id: string; title: string }[];
  memories: string[];
  focus: string;
}
const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max).filter(isObject) : []);

function parseRequest(body: unknown): { messages: ChatMessage[]; ctx: Ctx } | string {
  if (!isObject(body) || !Array.isArray(body.messages)) return 'Envie a conversa em "messages".';
  if (body.messages.length === 0 || body.messages.length > CHAT_LIMITS.messages) return `A conversa deve ter de 1 a ${CHAT_LIMITS.messages} mensagens.`;
  const messages: ChatMessage[] = [];
  for (const m of body.messages) {
    if (!isObject(m) || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') return 'Mensagem inválida.';
    const text = m.text.trim();
    if (!text || text.length > CHAT_LIMITS.text) return `Cada mensagem deve ter de 1 a ${CHAT_LIMITS.text} caracteres.`;
    messages.push({ role: m.role, text });
  }
  while (messages[0]?.role === 'assistant') messages.shift();
  if (messages.length === 0 || messages[messages.length - 1]!.role !== 'user') return 'A última mensagem deve ser da pessoa.';
  const c = isObject(body.context) ? body.context : {};
  const ctx: Ctx = {
    projects: arr(c.projects, CHAT_LIMITS.projects).map(p => ({ id: str(p.id, 200), title: str(p.title, 120), status: str(p.status, 30), goal: str(p.goal, 300) })).filter(p => p.id && p.title),
    ideas: arr(c.ideas, CHAT_LIMITS.ideas).map(i => ({ id: str(i.id, 200), title: str(i.title, 120), status: str(i.status, 30), projectId: str(i.projectId, 200) || null })).filter(i => i.id && i.title),
    notes: arr(c.notes, CHAT_LIMITS.notes).map(n => ({ id: str(n.id, 200), title: str(n.title, 120) })).filter(n => n.id && n.title),
    memories: (Array.isArray(c.memories) ? c.memories.slice(0, CHAT_LIMITS.memories) : []).map(x => str(x, CHAT_LIMITS.fact)).filter(Boolean),
    focus: str(c.focus, CHAT_LIMITS.focus),
  };
  return { messages, ctx };
}

function contextText(c: Ctx): string {
  const lines = ['Contexto (dados salvos no aparelho da pessoa):'];
  lines.push(c.projects.length ? 'Projetos:\n' + c.projects.map(p => `- [${p.id}] ${p.title} (${p.status})${p.goal ? ': ' + p.goal : ''}`).join('\n') : 'Projetos: nenhum.');
  lines.push(c.ideas.length ? 'Ideias:\n' + c.ideas.map(i => `- ${i.title} (${i.status})${i.projectId ? ' [projeto ' + i.projectId + ']' : ''}`).join('\n') : 'Ideias: nenhuma.');
  lines.push(c.notes.length ? 'Anotações recentes:\n' + c.notes.map(n => `- ${n.title}`).join('\n') : 'Anotações: nenhuma.');
  lines.push(c.memories.length ? 'Memórias sobre a pessoa:\n' + c.memories.map(m => `- ${m}`).join('\n') : 'Memórias: nenhuma ainda.');
  if (c.focus) lines.push('Em discussão agora (a pessoa abriu este item para conversar sobre ele):\n' + c.focus);
  return lines.join('\n\n');
}

/** Converte os blocos de resposta do modelo em texto, sugestões e memórias. Entradas inválidas são descartadas. */
export function readModelContent(content: unknown, projectIds: Set<string>): ChatResponse {
  const texts: string[] = [];
  const proposals: ProposalDraft[] = [];
  const remembered: string[] = [];
  for (const block of Array.isArray(content) ? content : []) {
    if (!isObject(block)) continue;
    if (block.type === 'text' && typeof block.text === 'string') { texts.push(block.text.trim()); continue; }
    if (block.type !== 'tool_use' || !isObject(block.input)) continue;
    const i = block.input;
    if (block.name === 'propose_idea' && str(i.title, 120)) proposals.push({ kind: 'idea', title: str(i.title, 120), body: str(i.body, CHAT_LIMITS.body), projectId: null });
    else if (block.name === 'propose_project' && str(i.title, 120)) proposals.push({ kind: 'project', title: str(i.title, 120), body: str(i.goal, CHAT_LIMITS.body), projectId: null });
    else if (block.name === 'propose_note' && str(i.title, 120)) proposals.push({ kind: 'note', title: str(i.title, 120), body: str(i.body, 4000), projectId: null });
    else if (block.name === 'propose_decision' && projectIds.has(str(i.projectId, 200)) && str(i.text, 1000))
      proposals.push({ kind: 'decision', title: '', body: str(i.text, 1000), projectId: str(i.projectId, 200) });
    else if (block.name === 'remember' && str(i.fact, CHAT_LIMITS.fact)) remembered.push(str(i.fact, CHAT_LIMITS.fact));
  }
  let text = texts.filter(Boolean).join('\n\n');
  const extras = { proposals: proposals.slice(0, 5), remembered: remembered.slice(0, 5) };
  if (!text && extras.proposals.length) text = 'Preparei uma sugestão para você.';
  if (!text && extras.remembered.length) text = 'Anotado.';
  return { text, ...extras };
}

export function createChatHandler(opts: HandlerOptions = {}) {
  const fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  const fails = new Map<string, number[]>();
  const recent = (m: Map<string, number[]>, ip: string, windowMs: number) => {
    const t = now();
    if (m.size > 5000) m.clear();
    const kept = (m.get(ip) ?? []).filter(x => t - x < windowMs);
    m.set(ip, kept);
    return kept;
  };
  const note = (m: Map<string, number[]>, ip: string) => { const a = m.get(ip) ?? []; a.push(now()); m.set(ip, a); };

  return async function handle(request: Request, env: ChatEnv): Promise<Response> {
    const model = env.STARK_MODEL || DEFAULT_MODEL;
    const code = env.STARK_ACCESS_CODE ?? '';
    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconhecido';
    const given = request.headers.get(ACCESS_HEADER);

    if (request.method === 'GET') {
      let authorized: boolean | null = null;
      if (given !== null) {
        if (recent(fails, ip, 600_000).length >= 8) return fail(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas com código incorreto. Aguarde alguns minutos.');
        authorized = !!code && safeEqual(given, code);
        if (!authorized) note(fails, ip);
      }
      const status: ChatStatus = { configured: { apiKey: !!env.ANTHROPIC_API_KEY, accessCode: !!code }, model, authorized };
      return json(200, status);
    }
    if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST.', { allow: 'GET, POST' });
    if (!env.ANTHROPIC_API_KEY || !code) return fail(503, 'NOT_CONFIGURED', 'O serviço de conversa ainda não foi configurado no servidor.');

    if (recent(fails, ip, 600_000).length >= 8) return fail(429, 'TOO_MANY_ATTEMPTS', 'Muitas tentativas com código incorreto. Aguarde alguns minutos.');
    if (given === null || !safeEqual(given, code)) { note(fails, ip); return fail(401, 'UNAUTHORIZED', 'Código de acesso incorreto.'); }
    if (recent(hits, ip, 60_000).length >= 30) return fail(429, 'RATE_LIMITED', 'Muitas mensagens em pouco tempo. Aguarde um instante.');
    note(hits, ip);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return fail(413, 'TOO_LARGE', 'A conversa é grande demais.');
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return fail(400, 'BAD_REQUEST', 'Corpo inválido.'); }
    const parsed = parseRequest(body);
    if (typeof parsed === 'string') return fail(400, 'BAD_REQUEST', parsed);

    const today = new Date(now()).toISOString().slice(0, 10);
    const payload = {
      model, max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\nData de hoje: ${today}.\n\n${contextText(parsed.ctx)}`,
      messages: parsed.messages.map(m => ({ role: m.role, content: m.text })),
      tools: TOOLS,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetchFn(`${(env.ANTHROPIC_API_URL || 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error('STARK chat: o serviço de IA respondeu', res.status);
        if (res.status === 401 || res.status === 403) return fail(502, 'UPSTREAM_AUTH', 'A chave do serviço de IA foi recusada. Verifique a configuração no servidor.');
        if (res.status === 429) return fail(429, 'UPSTREAM_RATE', 'O serviço de IA está com muitas solicitações. Tente de novo em instantes.');
        if (res.status === 400 || res.status === 404) return fail(502, 'UPSTREAM_BAD', 'O serviço de IA recusou o pedido. Confira o nome do modelo configurado.');
        return fail(502, 'UPSTREAM_DOWN', 'O serviço de IA está indisponível agora.');
      }
      const data: unknown = await res.json();
      const out = readModelContent(isObject(data) ? data.content : [], new Set(parsed.ctx.projects.map(p => p.id)));
      if (!out.text) return fail(502, 'EMPTY', 'O serviço de IA não devolveu uma resposta.');
      return json(200, out);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return fail(504, 'TIMEOUT', 'O serviço de IA demorou demais para responder.');
      console.error('STARK chat: falha ao chamar o serviço de IA');
      return fail(502, 'UPSTREAM_DOWN', 'Não foi possível falar com o serviço de IA.');
    } finally { clearTimeout(timer); }
  };
}
