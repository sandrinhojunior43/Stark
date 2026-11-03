export const IDEA_STATUSES = ['nova', 'explorando', 'arquivada'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = { nova: 'Nova', explorando: 'Explorando', arquivada: 'Arquivada' };

export const PROJECT_STATUSES = ['planejando', 'andamento', 'pausado', 'concluido'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = { planejando: 'Planejando', andamento: 'Em andamento', pausado: 'Pausado', concluido: 'Concluído' };

export const isIdeaStatus = (v: unknown): v is IdeaStatus => (IDEA_STATUSES as readonly unknown[]).includes(v);
export const isProjectStatus = (v: unknown): v is ProjectStatus => (PROJECT_STATUSES as readonly unknown[]).includes(v);

export const LIMITS = { title: 120, body: 20000, goal: 2000, analysis: 20000, step: 300, decision: 1000, memory: 300, message: 8000, steps: 100, decisions: 200 } as const;

export interface Note { id: string; title: string; body: string; createdAt: string; updatedAt: string }
export interface Idea { id: string; title: string; body: string; status: IdeaStatus; projectId: string | null; createdAt: string; updatedAt: string }
export interface Step { id: string; text: string; done: boolean }
export interface Decision { id: string; text: string; createdAt: string }
export interface Project {
  id: string; title: string; goal: string; status: ProjectStatus;
  steps: Step[]; analysis: string; decisions: Decision[]; createdAt: string; updatedAt: string;
}
