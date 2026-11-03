import { ACCESS_HEADER, type ApiErrorBody, type ChatRequest, type ChatResponse, type ChatStatus } from '@stark/contracts';

export class ChatError extends Error {
  constructor(message: string, public code: string) { super(message); }
}

const BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');
const TIMEOUT_MS = 65_000;

async function call<T>(method: 'GET' | 'POST', access: string, body?: unknown, signal?: AbortSignal, fetchFn: typeof fetch = fetch): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetchFn(`${BASE}/api/chat`, {
      method, signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(access ? { [ACCESS_HEADER]: access } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let data: unknown = null;
    try { data = await res.json(); } catch { /* corpo vazio ou HTML (ex.: função ausente) */ }
    if (!res.ok) {
      const e = (data as ApiErrorBody | null)?.error;
      if (e?.code) throw new ChatError(e.message, e.code);
      throw new ChatError(res.status === 404 ? 'O serviço de conversa não está publicado neste endereço.' : 'O serviço de conversa respondeu com erro.', 'HTTP_' + res.status);
    }
    if (data === null) throw new ChatError('O serviço de conversa não está publicado neste endereço.', 'NOT_FOUND');
    return data as T;
  } catch (e) {
    if (e instanceof ChatError) throw e;
    if (signal?.aborted) throw new ChatError('Cancelado.', 'ABORTED');
    if (e instanceof Error && e.name === 'AbortError') throw new ChatError('A resposta demorou demais. Tente de novo.', 'TIMEOUT');
    throw new ChatError('Não foi possível conectar. Confira sua conexão e tente de novo.', 'NETWORK');
  } finally { clearTimeout(timer); }
}

export const postChat = (req: ChatRequest, access: string, signal?: AbortSignal, fetchFn?: typeof fetch) => call<ChatResponse>('POST', access, req, signal, fetchFn);
export const getStatus = (access: string, fetchFn?: typeof fetch) => call<ChatStatus>('GET', access, undefined, undefined, fetchFn);
