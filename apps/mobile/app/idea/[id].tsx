import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { IDEA_STATUSES, IDEA_STATUS_LABELS, type Idea, type IdeaStatus } from '@stark/contracts';
import { useLocalState } from '../../src/data/LocalStateProvider';
import { addProject, deleteIdea, updateIdea, addIdea } from '../../src/data/actions';
import { confirmAction } from '../../src/data/device';
import { newId } from '../../src/data/state';
import { Chips, EditorScreen, Field, Message, Missing } from '../../src/ui/forms';
import { GlassButton, goBack } from '../../src/ui/glass';
import { Loading } from '../../src/ui/Loading';

export default function IdeaEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLocalState();
  if (!data) return <Loading />;
  const idea = id === 'new' ? null : data.ideas.find(i => i.id === id);
  if (idea === undefined) return <Missing what="ideia" />;
  return <IdeaForm key={idea?.id ?? 'new'} idea={idea} />;
}

function IdeaForm({ idea }: { idea: Idea | null }) {
  const { data, mutate } = useLocalState();
  const [title, setTitle] = useState(idea?.title ?? '');
  const [body, setBody] = useState(idea?.body ?? '');
  const [status, setStatus] = useState<IdeaStatus>(idea?.status ?? 'nova');
  const [projectId, setProjectId] = useState<string>(idea?.projectId ?? '');
  const [err, setErr] = useState<string | null>(null);
  const fields = { title, body, status, projectId: projectId || null };
  const save = async () => {
    setErr(null);
    const e = await mutate(s => (idea ? updateIdea(s, idea.id, fields) : addIdea(s, fields)));
    if (e) setErr(e); else goBack();
  };
  const discuss = async () => {
    if (!idea) return;
    const e = await mutate(s => updateIdea(s, idea.id, fields));
    if (e) setErr(e); else router.navigate({ pathname: '/', params: { focus: `idea:${idea.id}`, t: String(Date.now()) } });
  };
  const toProject = async () => {
    if (!idea) return;
    const pid = newId();
    const e = await mutate(s => updateIdea(addProject(s, { title, goal: body }, { id: pid }), idea.id, { ...fields, projectId: pid }));
    if (e) setErr(e); else router.replace(`/project/${pid}`);
  };
  const remove = async () => {
    if (!idea || !(await confirmAction('Excluir ideia?', 'Esta ação não pode ser desfeita.', 'Excluir'))) return;
    const e = await mutate(s => deleteIdea(s, idea.id));
    if (e) setErr(e); else goBack();
  };
  return <EditorScreen title={idea ? 'Ideia' : 'Nova ideia'}>
    <Field label="Título" value={title} onChangeText={setTitle} maxLength={120} placeholder="Em uma frase" />
    <Field label="Detalhes" value={body} onChangeText={setBody} multiline lines={6} placeholder="O que você imagina? Por quê?" />
    <Chips label="Situação" value={status} onChange={v => setStatus(v as IdeaStatus)} options={IDEA_STATUSES.map(s => ({ value: s, label: IDEA_STATUS_LABELS[s] }))} />
    {(data?.projects.length ?? 0) > 0 && <Chips label="Projeto" value={projectId} onChange={setProjectId}
      options={[{ value: '', label: 'Nenhum' }, ...data!.projects.map(p => ({ value: p.id, label: p.title }))]} />}
    {err && <Message text={err} />}
    <GlassButton title="Salvar" tone="primary" disabled={!title.trim()} onPress={() => void save()} />
    {idea && <GlassButton title="Discutir com o STARK" onPress={() => void discuss()} />}
    {idea && <GlassButton title="Criar projeto a partir desta ideia" onPress={() => void toProject()} />}
    {idea && <GlassButton tone="danger" title="Excluir ideia" onPress={() => void remove()} />}
  </EditorScreen>;
}
