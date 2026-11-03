import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, IDEA_STATUS_LABELS, type Decision, type Project, type ProjectStatus, type Step } from '@stark/contracts';
import { useLocalState } from '../../src/data/LocalStateProvider';
import { addProject, deleteProject, updateProject } from '../../src/data/actions';
import { confirmAction } from '../../src/data/device';
import { newId } from '../../src/data/state';
import { Chips, EditorScreen, Field, Message, Missing, Row } from '../../src/ui/forms';
import { Glass, GlassButton, Label, goBack } from '../../src/ui/glass';
import { formatWhen } from '../../src/ui/format';
import { Icon } from '../../src/ui/icons';
import { Loading } from '../../src/ui/Loading';
import { useTheme } from '../../src/ui/theme';

export default function ProjectEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLocalState();
  if (!data) return <Loading />;
  const project = id === 'new' ? null : data.projects.find(p => p.id === id);
  if (project === undefined) return <Missing what="projeto" />;
  return <ProjectForm key={project?.id ?? 'new'} project={project} />;
}

function AddLine({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (t: string) => void }) {
  const { c } = useTheme();
  const [t, setT] = useState('');
  const go = () => { if (t.trim()) { onAdd(t.trim()); setT(''); } };
  return <Glass radius={22} style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 6 }}>
    <TextInput accessibilityLabel={label} value={t} onChangeText={setT} onSubmitEditing={go} placeholder={placeholder} placeholderTextColor={c.faint} style={{ flex: 1, color: c.text, fontSize: 16, minHeight: 52 }} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar: ${label}`} disabled={!t.trim()} onPress={go} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: t.trim() ? 1 : 0.4 }}><Icon name="plus" size={22} color={c.accent} /></Pressable>
  </Glass>;
}

function ProjectForm({ project }: { project: Project | null }) {
  const { c } = useTheme();
  const { data, mutate } = useLocalState();
  const [title, setTitle] = useState(project?.title ?? '');
  const [goal, setGoal] = useState(project?.goal ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'planejando');
  const [steps, setSteps] = useState<Step[]>(project?.steps ?? []);
  const [analysis, setAnalysis] = useState(project?.analysis ?? '');
  const [decisions, setDecisions] = useState<Decision[]>(project?.decisions ?? []);
  const [err, setErr] = useState<string | null>(null);
  const patch = { title, goal, status, steps, analysis, decisions };
  const ideas = project ? (data?.ideas ?? []).filter(i => i.projectId === project.id) : [];

  const persist = async (): Promise<string | null> => {
    if (project) return mutate(s => updateProject(s, project.id, patch));
    const id = newId();
    const e = await mutate(s => updateProject(addProject(s, { title, goal, status, analysis }, { id }), id, { steps, decisions }));
    return e;
  };
  const save = async () => { setErr(null); const e = await persist(); if (e) setErr(e); else goBack(); };
  const discuss = async () => {
    if (!project) return;
    const e = await persist();
    if (e) setErr(e); else router.navigate({ pathname: '/', params: { focus: `project:${project.id}`, t: String(Date.now()) } });
  };
  const remove = async () => {
    if (!project || !(await confirmAction('Excluir projeto?', 'As ideias ligadas a ele continuam salvas, sem projeto. Esta ação não pode ser desfeita.', 'Excluir'))) return;
    const e = await mutate(s => deleteProject(s, project.id));
    if (e) setErr(e); else goBack();
  };

  return <EditorScreen title={project ? 'Projeto' : 'Novo projeto'}>
    <Field label="Nome" value={title} onChangeText={setTitle} maxLength={120} placeholder="Como se chama?" />
    <Field label="Objetivo" value={goal} onChangeText={setGoal} multiline lines={3} placeholder="O que você quer alcançar?" />
    <Chips label="Situação" value={status} onChange={v => setStatus(v as ProjectStatus)} options={PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS_LABELS[s] }))} />

    <View style={{ gap: 8 }}>
      <Label>Etapas</Label>
      {steps.map(st => <Glass key={st.id} radius={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 52 }}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`Etapa concluída: ${st.text}`} accessibilityState={{ checked: st.done }} onPress={() => setSteps(list => list.map(x => (x.id === st.id ? { ...x, done: !x.done } : x)))}
          style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: st.done ? c.accent : c.glassBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: st.done ? c.glassFillStrong : 'transparent' }}>
          {st.done && <Icon name="check" size={16} color={c.accent} strokeWidth={2.4} />}
        </Pressable>
        <Text style={{ flex: 1, color: st.done ? c.faint : c.text, fontSize: 16, paddingVertical: 12, textDecorationLine: st.done ? 'line-through' : 'none' }}>{st.text}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remover etapa: ${st.text}`} onPress={() => setSteps(list => list.filter(x => x.id !== st.id))} hitSlop={10}><Icon name="x" size={20} color={c.muted} /></Pressable>
      </Glass>)}
      <AddLine label="Nova etapa" placeholder="Adicionar etapa" onAdd={t => setSteps(list => [...list, { id: newId(), text: t, done: false }])} />
    </View>

    <Field label="Viabilidade e riscos" value={analysis} onChangeText={setAnalysis} multiline lines={4} placeholder="O que pode dar errado? Isso é viável?" />

    <View style={{ gap: 8 }}>
      <Label>Decisões</Label>
      {decisions.map(d => <Glass key={d.id} radius={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View style={{ flex: 1, gap: 2 }}><Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>{d.text}</Text><Text style={{ color: c.faint, fontSize: 13 }}>{formatWhen(d.createdAt)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remover decisão: ${d.text}`} onPress={() => setDecisions(list => list.filter(x => x.id !== d.id))} hitSlop={10}><Icon name="x" size={20} color={c.muted} /></Pressable>
      </Glass>)}
      <AddLine label="Nova decisão" placeholder="Registrar decisão" onAdd={t => setDecisions(list => [...list, { id: newId(), text: t, createdAt: new Date().toISOString() }])} />
    </View>

    {ideas.length > 0 && <View style={{ gap: 8 }}>
      <Label>Ideias ligadas</Label>
      {ideas.map(i => <Row key={i.id} icon="bulb" title={i.title} subtitle={IDEA_STATUS_LABELS[i.status]} onPress={() => router.push(`/idea/${i.id}`)} />)}
    </View>}

    {err && <Message text={err} />}
    <GlassButton title="Salvar" tone="primary" disabled={!title.trim()} onPress={() => void save()} />
    {project && <GlassButton title="Discutir com o STARK" onPress={() => void discuss()} />}
    {project && <GlassButton tone="danger" title="Excluir projeto" onPress={() => void remove()} />}
  </EditorScreen>;
}
