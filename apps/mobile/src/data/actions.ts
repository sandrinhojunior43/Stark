import { LIMITS, isIdeaStatus, isProjectStatus, type Decision, type Idea, type IdeaStatus, type Note, type Project, type ProjectStatus, type Step } from '@stark/contracts';
import { newId, StateError, type LocalState, type Via } from './state';

/** Operações puras sobre o estado: recebem um estado e devolvem outro, sem tocar no armazenamento. */
export interface Ctx { now?: Date; id?: string }
const stamp = (c?: Ctx) => (c?.now ?? new Date()).toISOString();
const mkId = (c?: Ctx) => c?.id ?? newId();
const touch = (s: LocalState, patch: Partial<LocalState>, c?: Ctx): LocalState => ({ ...s, ...patch, updatedAt: stamp(c) });

function title(v: string): string {
  const t = v.trim();
  if (!t) throw new StateError('Informe um título.');
  if (t.length > LIMITS.title) throw new StateError(`O título pode ter até ${LIMITS.title} caracteres.`);
  return t;
}
function text(v: string, max: number, label: string): string {
  const t = v.trim();
  if (t.length > max) throw new StateError(`${label} longo demais (máximo de ${max} caracteres).`);
  return t;
}
function find<T extends { id: string }>(items: T[], id: string, what: string): T {
  const item = items.find(x => x.id === id);
  if (!item) throw new StateError(`${what} não encontrado(a).`);
  return item;
}

/* Anotações (diário) */
export function addNote(s: LocalState, i: { title: string; body: string }, c?: Ctx): LocalState {
  const at = stamp(c);
  const note: Note = { id: mkId(c), title: title(i.title), body: text(i.body, LIMITS.body, 'Texto'), createdAt: at, updatedAt: at };
  return touch(s, { notes: [note, ...s.notes] }, c);
}
export function updateNote(s: LocalState, id: string, p: Partial<Pick<Note, 'title' | 'body'>>, c?: Ctx): LocalState {
  const cur = find(s.notes, id, 'Anotação');
  const next: Note = { ...cur, title: p.title === undefined ? cur.title : title(p.title), body: p.body === undefined ? cur.body : text(p.body, LIMITS.body, 'Texto'), updatedAt: stamp(c) };
  return touch(s, { notes: s.notes.map(n => (n.id === id ? next : n)) }, c);
}
export function deleteNote(s: LocalState, id: string, c?: Ctx): LocalState {
  find(s.notes, id, 'Anotação');
  return touch(s, { notes: s.notes.filter(n => n.id !== id) }, c);
}

/* Ideias */
function checkProject(s: LocalState, projectId: string | null) {
  if (projectId !== null && !s.projects.some(p => p.id === projectId)) throw new StateError('Projeto não encontrado.');
}
export function addIdea(s: LocalState, i: { title: string; body: string; status?: IdeaStatus; projectId?: string | null }, c?: Ctx): LocalState {
  const status = i.status ?? 'nova';
  if (!isIdeaStatus(status)) throw new StateError('Status de ideia inválido.');
  const projectId = i.projectId ?? null;
  checkProject(s, projectId);
  const at = stamp(c);
  const idea: Idea = { id: mkId(c), title: title(i.title), body: text(i.body, LIMITS.body, 'Texto'), status, projectId, createdAt: at, updatedAt: at };
  return touch(s, { ideas: [idea, ...s.ideas] }, c);
}
export function updateIdea(s: LocalState, id: string, p: Partial<Pick<Idea, 'title' | 'body' | 'status' | 'projectId'>>, c?: Ctx): LocalState {
  const cur = find(s.ideas, id, 'Ideia');
  if (p.status !== undefined && !isIdeaStatus(p.status)) throw new StateError('Status de ideia inválido.');
  if (p.projectId !== undefined) checkProject(s, p.projectId);
  const next: Idea = { ...cur, title: p.title === undefined ? cur.title : title(p.title), body: p.body === undefined ? cur.body : text(p.body, LIMITS.body, 'Texto'),
    status: p.status ?? cur.status, projectId: p.projectId === undefined ? cur.projectId : p.projectId, updatedAt: stamp(c) };
  return touch(s, { ideas: s.ideas.map(x => (x.id === id ? next : x)) }, c);
}
export function deleteIdea(s: LocalState, id: string, c?: Ctx): LocalState {
  find(s.ideas, id, 'Ideia');
  return touch(s, { ideas: s.ideas.filter(x => x.id !== id) }, c);
}

/* Projetos */
function cleanSteps(steps: Step[]): Step[] {
  if (steps.length > LIMITS.steps) throw new StateError(`Um projeto pode ter até ${LIMITS.steps} etapas.`);
  return steps.map(st => ({ id: st.id, text: text(st.text, LIMITS.step, 'Etapa'), done: !!st.done })).filter(st => st.text);
}
function cleanDecisions(ds: Decision[]): Decision[] {
  if (ds.length > LIMITS.decisions) throw new StateError(`Um projeto pode ter até ${LIMITS.decisions} decisões.`);
  return ds.map(d => ({ id: d.id, text: text(d.text, LIMITS.decision, 'Decisão'), createdAt: d.createdAt })).filter(d => d.text);
}
export function addProject(s: LocalState, i: { title: string; goal?: string; status?: ProjectStatus; analysis?: string; steps?: string[] }, c?: Ctx): LocalState {
  const status = i.status ?? 'planejando';
  if (!isProjectStatus(status)) throw new StateError('Status de projeto inválido.');
  const at = stamp(c);
  const project: Project = { id: mkId(c), title: title(i.title), goal: text(i.goal ?? '', LIMITS.goal, 'Objetivo'), status,
    steps: cleanSteps((i.steps ?? []).map(t => ({ id: newId(), text: t, done: false }))), analysis: text(i.analysis ?? '', LIMITS.analysis, 'Análise'),
    decisions: [], createdAt: at, updatedAt: at };
  return touch(s, { projects: [project, ...s.projects] }, c);
}
export function updateProject(s: LocalState, id: string, p: Partial<Pick<Project, 'title' | 'goal' | 'status' | 'steps' | 'analysis' | 'decisions'>>, c?: Ctx): LocalState {
  const cur = find(s.projects, id, 'Projeto');
  if (p.status !== undefined && !isProjectStatus(p.status)) throw new StateError('Status de projeto inválido.');
  const next: Project = { ...cur,
    title: p.title === undefined ? cur.title : title(p.title), goal: p.goal === undefined ? cur.goal : text(p.goal, LIMITS.goal, 'Objetivo'),
    status: p.status ?? cur.status, steps: p.steps === undefined ? cur.steps : cleanSteps(p.steps),
    analysis: p.analysis === undefined ? cur.analysis : text(p.analysis, LIMITS.analysis, 'Análise'),
    decisions: p.decisions === undefined ? cur.decisions : cleanDecisions(p.decisions), updatedAt: stamp(c) };
  return touch(s, { projects: s.projects.map(x => (x.id === id ? next : x)) }, c);
}
/** Ao excluir um projeto, as ideias ligadas a ele continuam existindo, só sem projeto. */
export function deleteProject(s: LocalState, id: string, c?: Ctx): LocalState {
  find(s.projects, id, 'Projeto');
  return touch(s, { projects: s.projects.filter(p => p.id !== id), ideas: s.ideas.map(i => (i.projectId === id ? { ...i, projectId: null } : i)) }, c);
}
export function addDecision(s: LocalState, projectId: string, value: string, c?: Ctx): LocalState {
  const cur = find(s.projects, projectId, 'Projeto');
  const d: Decision = { id: mkId(c), text: text(value, LIMITS.decision, 'Decisão'), createdAt: stamp(c) };
  if (!d.text) throw new StateError('Descreva a decisão.');
  return updateProject(s, projectId, { decisions: [...cur.decisions, d] }, c);
}

/* Memória e histórico */
export function addMemory(s: LocalState, value: string, c?: Ctx): LocalState {
  const t = value.trim();
  if (!t) throw new StateError('A memória está vazia.');
  if (t.length > LIMITS.memory) throw new StateError(`Uma memória pode ter até ${LIMITS.memory} caracteres.`);
  if (s.memories.some(m => m.text.toLowerCase() === t.toLowerCase())) return s;
  return touch(s, { memories: [...s.memories, { id: mkId(c), text: t, createdAt: stamp(c) }] }, c);
}
export function removeMemory(s: LocalState, id: string, c?: Ctx): LocalState {
  return s.memories.some(m => m.id === id) ? touch(s, { memories: s.memories.filter(m => m.id !== id) }, c) : s;
}
export const clearMemories = (s: LocalState, c?: Ctx): LocalState => touch(s, { memories: [] }, c);

export function appendMessages(s: LocalState, msgs: { role: 'user' | 'assistant'; text: string; via: Via }[], c?: Ctx): LocalState {
  const at = stamp(c);
  const added = msgs.map((m, i) => {
    const t = m.text.trim();
    if (!t) throw new StateError('A mensagem está vazia.');
    return { id: msgs.length === 1 ? mkId(c) : newId(), role: m.role, text: t.slice(0, 20000), via: m.via, createdAt: new Date(new Date(at).getTime() + i).toISOString() };
  });
  return touch(s, { messages: [...s.messages, ...added] }, c);
}
export const clearMessages = (s: LocalState, c?: Ctx): LocalState => touch(s, { messages: [] }, c);
