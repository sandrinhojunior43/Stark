import { useState } from 'react';
import { router } from 'expo-router';
import { useLocalState } from '../src/data/LocalStateProvider';
import { clip } from '../src/chat/text';
import { Row } from '../src/ui/forms';
import { formatWhen, matches } from '../src/ui/format';
import { Section } from '../src/ui/Section';

export default function Journal() {
  const { data } = useLocalState();
  const [q, setQ] = useState('');
  const all = data?.notes ?? [];
  const notes = all.filter(n => matches(q, n.title, n.body)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <Section icon="doc" title="Diário de Anotações" subtitle="Seus dias e pensamentos, organizados." emptyTitle="Nenhuma anotação ainda"
    emptyBody="Toque em + para registrar seu primeiro pensamento. Você também pode pedir ao STARK que sugira anotações durante a conversa."
    total={all.length} shown={notes.length} query={q} onQuery={setQ} onAdd={() => router.push('/note/new')} addLabel="Nova anotação">
    {notes.map(n => <Row key={n.id} icon="doc" title={n.title} subtitle={clip(n.body.replace(/\s+/g, ' '), 70)} meta={formatWhen(n.updatedAt)} onPress={() => router.push(`/note/${n.id}`)} />)}
  </Section>;
}
