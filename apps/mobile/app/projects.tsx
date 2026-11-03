import { useState } from 'react';
import { router } from 'expo-router';
import { PROJECT_STATUS_LABELS } from '@stark/contracts';
import { useLocalState } from '../src/data/LocalStateProvider';
import { Row } from '../src/ui/forms';
import { formatWhen, matches } from '../src/ui/format';
import { Section } from '../src/ui/Section';

export default function Projects() {
  const { data } = useLocalState();
  const [q, setQ] = useState('');
  const all = data?.projects ?? [];
  const projects = all.filter(p => matches(q, p.title, p.goal, p.analysis)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <Section icon="folder" title="Projetos" subtitle="O que você quer construir." emptyTitle="Nenhum projeto ainda"
    emptyBody="Toque em + para criar um projeto com objetivo, etapas, riscos e decisões. O STARK ajuda a discuti-lo."
    total={all.length} shown={projects.length} query={q} onQuery={setQ} onAdd={() => router.push('/project/new')} addLabel="Novo projeto">
    {projects.map(p => {
      const done = p.steps.filter(s => s.done).length;
      return <Row key={p.id} icon="folder" title={p.title} subtitle={[PROJECT_STATUS_LABELS[p.status], p.steps.length ? `${done}/${p.steps.length} etapas` : ''].filter(Boolean).join(' · ')} meta={formatWhen(p.updatedAt)} onPress={() => router.push(`/project/${p.id}`)} />;
    })}
  </Section>;
}
