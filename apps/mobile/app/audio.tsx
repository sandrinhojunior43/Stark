import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useLocalState } from '../src/data/LocalStateProvider';
import { clearMessages } from '../src/data/actions';
import { confirmAction } from '../src/data/device';
import { GlassButton, Glass } from '../src/ui/glass';
import { Icon } from '../src/ui/icons';
import { formatDay, matches } from '../src/ui/format';
import { Section } from '../src/ui/Section';
import { useTheme } from '../src/ui/theme';

/** Histórico único de conversas, faladas e escritas. As gravações de áudio em si não são guardadas. */
export default function History() {
  const { c } = useTheme();
  const { data, mutate } = useLocalState();
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const all = data?.messages ?? [];
  const msgs = all.filter(m => matches(q, m.text));
  const days: { day: string; items: typeof msgs }[] = [];
  for (const m of msgs) {
    const day = formatDay(m.createdAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(m); else days.push({ day, items: [m] });
  }
  days.reverse();
  const clear = async () => {
    if (!(await confirmAction('Apagar o histórico?', 'Todas as conversas deste aparelho serão removidas. Projetos, ideias, anotações e memórias não são afetados.', 'Apagar'))) return;
    setErr(await mutate(s => clearMessages(s)));
  };
  return <Section icon="wave" title="Histórico de Áudio" subtitle="Suas conversas, faladas e escritas." emptyTitle="Nenhuma conversa ainda"
    emptyBody="Toque em conversar para falar ou escrever com o STARK. O histórico fica aqui, só neste aparelho."
    total={all.length} shown={msgs.length} query={q} onQuery={setQ} onAdd={() => router.navigate({ pathname: '/', params: { talk: '1', t: String(Date.now()) } })} addIcon="wave" addLabel="Continuar a conversa">
    {days.map(d => <View key={d.day} style={{ gap: 10 }}>
      <Text style={{ color: c.faint, fontSize: 14, fontWeight: '600', marginLeft: 6 }}>{d.day}</Text>
      {d.items.map(m => <Glass key={m.id} radius={22} strong={m.role === 'user'} style={{ padding: 16, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: m.role === 'user' ? c.accent : c.muted, fontSize: 14, fontWeight: '600' }}>{m.role === 'user' ? 'Você' : 'STARK'}</Text>
          {m.via === 'voice' && <Icon name="mic" size={14} color={c.faint} />}
          <Text style={{ color: c.faint, fontSize: 13 }}>{new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <Text style={{ color: c.text, fontSize: 16, lineHeight: 23 }}>{m.text}</Text>
      </Glass>)}
    </View>)}
    {err && <Text style={{ color: c.dangerText }}>{err}</Text>}
    <GlassButton tone="danger" title="Apagar histórico" onPress={() => void clear()} />
  </Section>;
}
