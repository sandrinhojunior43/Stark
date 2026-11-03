import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalState } from '../src/data/LocalStateProvider';
import { addMemory, clearMemories, removeMemory } from '../src/data/actions';
import { confirmAction } from '../src/data/device';
import { EditorScreen, Field, Message } from '../src/ui/forms';
import { Glass, GlassButton } from '../src/ui/glass';
import { Icon } from '../src/ui/icons';
import { formatWhen } from '../src/ui/format';
import { useTheme } from '../src/ui/theme';

export default function Memory() {
  const { c } = useTheme();
  const { data, mutate } = useLocalState();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const memories = [...(data?.memories ?? [])].reverse();
  const add = async () => { setErr(null); const e = await mutate(s => addMemory(s, text)); if (e) setErr(e); else setText(''); };
  const wipe = async () => { if (await confirmAction('Apagar toda a memória?', 'O STARK deixará de lembrar o que aprendeu sobre você.', 'Apagar')) setErr(await mutate(s => clearMemories(s))); };
  return <EditorScreen title="Memória do STARK" subtitle="Fatos que o STARK guarda sobre você para conversar com mais contexto. Ficam só neste aparelho; você pode corrigir ou apagar.">
    <Field label="Adicionar à memória" value={text} onChangeText={setText} maxLength={300} placeholder="Ex.: Prefiro respostas curtas e diretas." />
    <GlassButton title="Adicionar" tone="primary" disabled={!text.trim()} onPress={() => void add()} />
    {err && <Message text={err} />}
    {memories.length === 0
      ? <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24 }}>Ainda não há nada guardado. Conforme vocês conversam, o STARK pode memorizar preferências e metas, e avisa quando faz isso.</Text>
      : <View style={{ gap: 12 }}>{memories.map(m => <Glass key={m.id} radius={22} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>{m.text}</Text><Text style={{ color: c.faint, fontSize: 13 }}>{formatWhen(m.createdAt)}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Apagar memória: ${m.text}`} onPress={() => void mutate(s => removeMemory(s, m.id))} hitSlop={10}><Icon name="x" size={22} color={c.muted} /></Pressable>
        </Glass>)}
        <GlassButton tone="danger" title="Apagar toda a memória" onPress={() => void wipe()} /></View>}
  </EditorScreen>;
}
