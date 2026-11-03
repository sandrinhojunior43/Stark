import { createChatHandler } from './_lib/chat-core';

// As chaves vêm das variáveis de ambiente do projeto na Vercel; nada fica no código.
const env = () => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const handle = createChatHandler();

export async function GET(request: Request) { return handle(request, env()); }
export async function POST(request: Request) { return handle(request, env()); }
