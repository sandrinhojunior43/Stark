import { useState } from 'react';
import { router } from 'expo-router';
import { IDEA_STATUS_LABELS } from '@stark/contracts';
import { useLocalState } from '../src/data/LocalStateProvider';
import { Row } from '../src/ui/forms';
import { formatWhen, matches } from '../src/ui/format';
import { Section } from '../src/ui/Section';

export default function Ideas() {
  const { data } = useLocalState();
  const [q, setQ] = useState('');
  const all = data?.ideas ?? [];
  const title = (id: string | null) => data?.projects.find(p => p.id === id)?.title;
  const ideas = all.filter(i => matches(q, i.title, i.body, title(i.projectId) ?? '')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <Section icon="bulb" title="Ideias" subtitle="Pensamentos ainda tomando forma." emptyTitle="Nenhuma ideia guardada"
    emptyBody="Toque em + para registrar uma ideia rápida. Quando ela amadurecer, transforme-a em projeto."
    total={all.length} shown={ideas.length} query={q} onQuery={setQ} onAdd={() => router.push('/idea/new')} addLabel="Nova ideia">
    {ideas.map(i => <Row key={i.id} icon="bulb" title={i.title} subtitle={[IDEA_STATUS_LABELS[i.status], title(i.projectId)].filter(Boolean).join(' · ')} meta={formatWhen(i.updatedAt)} onPress={() => router.push(`/idea/${i.id}`)} />)}
  </Section>;
}
