import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import type { Note } from '@stark/contracts';
import { useLocalState } from '../../src/data/LocalStateProvider';
import { addNote, deleteNote, updateNote } from '../../src/data/actions';
import { confirmAction } from '../../src/data/device';
import { EditorScreen, Field, Message, Missing } from '../../src/ui/forms';
import { GlassButton, goBack } from '../../src/ui/glass';
import { Loading } from '../../src/ui/Loading';

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLocalState();
  if (!data) return <Loading />;
  const note = id === 'new' ? null : data.notes.find(n => n.id === id);
  if (note === undefined) return <Missing what="anotação" />;
  return <NoteForm key={note?.id ?? 'new'} note={note} />;
}

function NoteForm({ note }: { note: Note | null }) {
  const { mutate } = useLocalState();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    const e = await mutate(s => (note ? updateNote(s, note.id, { title, body }) : addNote(s, { title, body })));
    if (e) setErr(e); else goBack();
  };
  const discuss = async () => {
    if (!note) return;
    const e = await mutate(s => updateNote(s, note.id, { title, body }));
    if (e) setErr(e); else router.navigate({ pathname: '/', params: { focus: `note:${note.id}`, t: String(Date.now()) } });
  };
  const remove = async () => {
    if (!note || !(await confirmAction('Excluir anotação?', 'Esta ação não pode ser desfeita.', 'Excluir'))) return;
    const e = await mutate(s => deleteNote(s, note.id));
    if (e) setErr(e); else goBack();
  };
  return <EditorScreen title={note ? 'Anotação' : 'Nova anotação'}>
    <Field label="Título" value={title} onChangeText={setTitle} maxLength={120} placeholder="Do que se trata?" />
    <Field label="Texto" value={body} onChangeText={setBody} multiline lines={8} placeholder="Escreva livremente…" />
    {err && <Message text={err} />}
    <GlassButton title="Salvar" tone="primary" disabled={!title.trim()} onPress={() => void save()} />
    {note && <GlassButton title="Discutir com o STARK" onPress={() => void discuss()} />}
    {note && <GlassButton tone="danger" title="Excluir anotação" onPress={() => void remove()} />}
  </EditorScreen>;
}
