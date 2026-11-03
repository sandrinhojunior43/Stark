import type { IdeaStatus, ProjectStatus } from './domain';

export const ACCESS_HEADER = 'x-stark-access';
export const CHAT_LIMITS = { messages: 40, text: 8000, projects: 30, ideas: 40, notes: 15, memories: 40, focus: 4000, body: 2000, fact: 300 } as const;

export interface ChatMessage { role: 'user' | 'assistant'; text: string }
/** Resumo dos dados do aparelho enviado junto com a conversa. Não contém a voz escolhida. */
export interface ChatContext {
  projects: { id: string; title: string; status: ProjectStatus; goal: string }[];
  ideas: { id: string; title: string; status: IdeaStatus; projectId: string | null }[];
  notes: { id: string; title: string }[];
  memories: string[];
  /** Texto do item em discussão ('' se nenhum). */
  focus: string;
}
export interface ChatRequest { messages: ChatMessage[]; context: ChatContext }

export type ProposalKind = 'idea' | 'project' | 'note' | 'decision';
export interface ProposalDraft { kind: ProposalKind; title: string; body: string; projectId: string | null }
export interface ChatResponse { text: string; proposals: ProposalDraft[]; remembered: string[] }
export interface ApiErrorBody { error: { code: string; message: string } }
export interface ChatStatus { configured: { apiKey: boolean; accessCode: boolean }; model: string; authorized: boolean | null }
