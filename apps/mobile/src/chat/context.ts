import { CHAT_LIMITS, IDEA_STATUS_LABELS, PROJECT_STATUS_LABELS, type ChatContext, type ChatMessage } from '@stark/contracts';
import type { LocalState } from '../data/state';
import { clip } from './text';

export interface Focus { kind: 'project' | 'idea' | 'note'; id: string }

const byRecent = <T extends { updatedAt: string }>(a: T, b: T) => b.updatedAt.localeCompare(a.updatedAt);

function focusText(s: LocalState, f: Focus | null): string {
  if (!f) return '';
  if (f.kind === 'project') {
    const p = s.projects.find(x => x.id === f.id);
    if (!p) return '';
    const ideas = s.ideas.filter(i => i.projectId === p.id).map(i => i.title);
    return clip([
      `Projeto "${p.title}" — ${PROJECT_STATUS_LABELS[p.status]}`,
      p.goal && `Objetivo: ${p.goal}`,
      p.steps.length && `Etapas: ${p.steps.map(st => `${st.done ? '[x]' : '[ ]'} ${st.text}`).join('; ')}`,
      p.analysis && `Viabilidade e riscos: ${p.analysis}`,
      p.decisions.length && `Decisões: ${p.decisions.map(d => d.text).join('; ')}`,
      ideas.length && `Ideias ligadas: ${ideas.join('; ')}`,
    ].filter(Boolean).join('\n'), CHAT_LIMITS.focus);
  }
  if (f.kind === 'idea') {
    const i = s.ideas.find(x => x.id === f.id);
    if (!i) return '';
    const project = s.projects.find(p => p.id === i.projectId);
    return clip([`Ideia "${i.title}" — ${IDEA_STATUS_LABELS[i.status]}`, i.body, project && `Ligada ao projeto "${project.title}"`].filter(Boolean).join('\n'), CHAT_LIMITS.focus);
  }
  const n = s.notes.find(x => x.id === f.id);
  return n ? clip(`Anotação "${n.title}"\n${n.body}`, CHAT_LIMITS.focus) : '';
}

/** Resumo do que o aparelho sabe. Nunca inclui a voz escolhida: ela não influencia o raciocínio. */
export function buildContext(s: LocalState, focus: Focus | null): ChatContext {
  return {
    projects: [...s.projects].sort(byRecent).slice(0, CHAT_LIMITS.projects).map(p => ({ id: p.id, title: p.title, status: p.status, goal: clip(p.goal, 200) })),
    ideas: [...s.ideas].sort(byRecent).slice(0, CHAT_LIMITS.ideas).map(i => ({ id: i.id, title: i.title, status: i.status, projectId: i.projectId })),
    notes: [...s.notes].sort(byRecent).slice(0, CHAT_LIMITS.notes).map(n => ({ id: n.id, title: n.title })),
    memories: s.memories.slice(-CHAT_LIMITS.memories).map(m => m.text),
    focus: focusText(s, focus),
  };
}

export function buildMessages(s: LocalState, limit = 20): ChatMessage[] {
  return s.messages.slice(-limit).map(m => ({ role: m.role, text: m.text.slice(0, CHAT_LIMITS.text) }));
}
