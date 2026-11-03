import { describe, it, expect } from 'vitest';
import { createInitialState, StateError, isLocalState, parseBackup, serializeBackup } from '../src/data/state';
import { addDecision, addIdea, addMemory, addNote, addProject, appendMessages, clearMemories, clearMessages, deleteIdea, deleteNote, deleteProject,
  removeMemory, updateIdea, updateNote, updateProject } from '../src/data/actions';

const ids = () => { let n = 0; return () => `id-${++n}`; };
const fresh = () => createInitialState(ids());
const T = new Date('2026-11-03T12:00:00Z');

describe('anotações', () => {
  it('cria, edita e exclui; a mais recente fica primeiro', () => {
    let s = addNote(fresh(), { title: '  Hoje  ', body: ' texto ' }, { id: 'n1', now: T });
    s = addNote(s, { title: 'Outra', body: '' }, { id: 'n2', now: T });
    expect(s.notes.map(n => n.id)).toEqual(['n2', 'n1']);
    expect(s.notes[1]).toMatchObject({ title: 'Hoje', body: 'texto' });
    s = updateNote(s, 'n1', { body: 'novo' }, { now: new Date('2026-11-04T12:00:00Z') });
    expect(s.notes[1]!.body).toBe('novo'); expect(s.notes[1]!.updatedAt).toBe('2026-11-04T12:00:00.000Z');
    expect(deleteNote(s, 'n2').notes.map(n => n.id)).toEqual(['n1']);
    expect(isLocalState(s)).toBe(true);
  });
  it('recusa título vazio, título longo e item inexistente', () => {
    expect(() => addNote(fresh(), { title: '  ', body: '' })).toThrow('título');
    expect(() => addNote(fresh(), { title: 'x'.repeat(121), body: '' })).toThrow(StateError);
    expect(() => updateNote(fresh(), 'nada', { body: 'x' })).toThrow('não encontrad');
  });
});

describe('ideias e projetos', () => {
  it('ideia ligada a projeto; excluir o projeto solta a ideia sem apagá-la', () => {
    let s = addProject(fresh(), { title: 'App', goal: 'Meta' }, { id: 'p1' });
    s = addIdea(s, { title: 'Ideia', body: 'corpo', projectId: 'p1' }, { id: 'i1' });
    expect(s.ideas[0]!.projectId).toBe('p1');
    s = deleteProject(s, 'p1');
    expect(s.projects).toEqual([]); expect(s.ideas[0]).toMatchObject({ id: 'i1', projectId: null });
    expect(isLocalState(s)).toBe(true);
  });
  it('rejeita projeto inexistente e status inválido', () => {
    expect(() => addIdea(fresh(), { title: 'x', body: '', projectId: 'nope' })).toThrow('Projeto');
    expect(() => addIdea(fresh(), { title: 'x', body: '', status: 'zzz' as never })).toThrow('Status');
    const s = addIdea(fresh(), { title: 'x', body: '' }, { id: 'i' });
    expect(() => updateIdea(s, 'i', { projectId: 'nope' })).toThrow('Projeto');
    expect(updateIdea(s, 'i', { status: 'explorando' }).ideas[0]!.status).toBe('explorando');
    expect(deleteIdea(s, 'i').ideas).toEqual([]);
  });
  it('etapas e decisões: limpa vazias, preserva ids e registra decisões em ordem', () => {
    let s = addProject(fresh(), { title: 'P', steps: ['a', '  ', 'b'] }, { id: 'p' });
    expect(s.projects[0]!.steps.map(x => x.text)).toEqual(['a', 'b']);
    const st = s.projects[0]!.steps;
    s = updateProject(s, 'p', { steps: [{ ...st[0]!, done: true }, st[1]!], status: 'andamento', analysis: 'risco X' });
    expect(s.projects[0]).toMatchObject({ status: 'andamento', analysis: 'risco X' });
    expect(s.projects[0]!.steps[0]!.done).toBe(true);
    s = addDecision(s, 'p', 'Usar PWA', { now: T });
    s = addDecision(s, 'p', 'Sem servidor dedicado', { now: T });
    expect(s.projects[0]!.decisions.map(d => d.text)).toEqual(['Usar PWA', 'Sem servidor dedicado']);
    expect(() => addDecision(s, 'p', '   ')).toThrow();
    expect(() => addDecision(s, 'outro', 'x')).toThrow('não encontrad');
    expect(isLocalState(s)).toBe(true);
  });
  it('limita etapas', () => {
    const many = Array.from({ length: 101 }, (_, i) => `e${i}`);
    expect(() => addProject(fresh(), { title: 'P', steps: many })).toThrow('etapas');
  });
});

describe('memória e histórico', () => {
  it('memória sem duplicatas (ignora caixa), com remoção e limpeza', () => {
    let s = addMemory(fresh(), ' Prefere respostas curtas ', { id: 'm1' });
    const again = addMemory(s, 'prefere respostas CURTAS');
    expect(again).toBe(s);
    s = addMemory(s, 'Trabalha à noite', { id: 'm2' });
    expect(removeMemory(s, 'm1').memories.map(m => m.id)).toEqual(['m2']);
    expect(clearMemories(s).memories).toEqual([]);
    expect(() => addMemory(s, '')).toThrow(); expect(() => addMemory(s, 'x'.repeat(301))).toThrow();
  });
  it('mensagens mantêm ordem, canal e podem ser apagadas', () => {
    let s = appendMessages(fresh(), [{ role: 'user', text: 'oi', via: 'voice' }, { role: 'assistant', text: 'olá', via: 'text' }], { now: T });
    expect(s.messages.map(m => [m.role, m.via])).toEqual([['user', 'voice'], ['assistant', 'text']]);
    expect(isLocalState(s)).toBe(true);
    expect(() => appendMessages(s, [{ role: 'user', text: '  ', via: 'text' }])).toThrow();
    expect(clearMessages(s).messages).toEqual([]);
  });
});

describe('voz não afeta nada do conteúdo', () => {
  it('conteúdo salvo é idêntico ao trocar Wells ↔ Stark', async () => {
    const { withVoice } = await import('../src/data/state');
    let s = addProject(fresh(), { title: 'P' }, { id: 'p' });
    s = addIdea(s, { title: 'I', body: '' }, { id: 'i' });
    s = addMemory(s, 'fato', { id: 'm' });
    const swapped = withVoice(withVoice(s, 'stark'), 'wells');
    expect({ ...swapped, updatedAt: 0, me: 0 }).toEqual({ ...s, updatedAt: 0, me: 0 });
    expect(swapped.me.contextId).toBe(s.me.contextId);
  });
  it('backup completo faz ida e volta com projetos, ideias, notas, memória e histórico', () => {
    let s = addProject(fresh(), { title: 'P', steps: ['a'] }, { id: 'p' });
    s = addIdea(s, { title: 'I', body: 'b', projectId: 'p' }, { id: 'i' });
    s = addNote(s, { title: 'N', body: 'c' }, { id: 'n' });
    s = addMemory(s, 'fato', { id: 'm' });
    s = appendMessages(s, [{ role: 'user', text: 'oi', via: 'voice' }]);
    expect(parseBackup(serializeBackup(s))).toEqual(s);
  });
});
