import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, type TextStyle } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PROJECT_STATUS_LABELS } from '@stark/contracts';
import { useLocalState } from '../src/data/LocalStateProvider';
import { useConversation, type Phase } from '../src/chat/useConversation';
import type { Focus } from '../src/chat/context';
import { Icon, type IconName } from '../src/ui/icons';
import { Glass, GlassButton, GlassScreen, Notice, RoundButton } from '../src/ui/glass';
import { useReduceMotion, useScreenFocused } from '../src/ui/hooks';
import { Sphere } from '../src/ui/Sphere';
import { useTheme } from '../src/ui/theme';

const MENU: { id: string; icon: IconName; label: string }[] = [
  { id: 'journal', icon: 'doc', label: 'Diário de Anotações' },
  { id: 'projects', icon: 'folder', label: 'Projetos' },
  { id: 'ideas', icon: 'bulb', label: 'Ideias' },
  { id: 'audio', icon: 'wave', label: 'Histórico de Áudio' },
];
const SPHERE_MODE = { idle: 'rest', listening: 'listening', thinking: 'processing', speaking: 'speaking' } as const;
const fill = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;
const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;
const only = (on: boolean) => ({ pointerEvents: on ? 'auto' : 'none' } as const);

function parseFocus(v: string | undefined): Focus | null {
  const [kind, id] = (v ?? '').split(':');
  return (kind === 'project' || kind === 'idea' || kind === 'note') && id ? { kind, id } : null;
}

function status(phase: Phase, interim: string, support: { recognition: boolean }) {
  if (phase === 'listening') return interim || 'Ouvindo…';
  if (phase === 'thinking') return 'Pensando…';
  if (phase === 'speaking') return 'Falando…';
  return support.recognition ? 'Toque na esfera para falar, ou escreva abaixo.' : 'Escreva abaixo para conversar.';
}

export default function Home() {
  const { c, mode, sphere } = useTheme();
  const { data, error: dataError, unreadable, reload } = useLocalState();
  const { width, height } = useWindowDimensions();
  const focused = useScreenFocused();
  const reduce = useReduceMotion();
  const params = useLocalSearchParams<{ talk?: string; focus?: string; t?: string }>();
  const [talking, setTalking] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [draft, setDraft] = useState('');
  const convo = useConversation(focus);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const f = parseFocus(params.focus);
    if (f) { setFocus(f); setTalking(true); } else if (params.talk) setTalking(true);
  }, [params.focus, params.talk, params.t]);
  useEffect(() => {
    Animated.timing(grow, { toValue: talking ? 1 : 0, duration: reduce ? 0 : 560, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [talking, reduce, grow]);
  useEffect(() => { if (!focused) { convo.stopAll(); } }, [focused]);

  const close = () => { convo.stopAll(); setTalking(false); setFocus(null); };
  const open = (listen: boolean) => { setTalking(true); if (listen) convo.press(); };
  const submit = () => { const t = draft.trim(); if (t) { setDraft(''); void convo.send(t, 'text'); } };

  // Na conversa, a área de texto ganha espaço (respostas e sugestões precisam ficar visíveis) e a esfera cede um pouco.
  const lowerH = talking ? Math.round(Math.min(300, Math.max(200, height * 0.32))) : 170;
  const base = Math.max(140, Math.min(300, width * 0.78, height - 260 - lowerH));
  const scale = grow.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const rest = grow.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' });
  const talk = grow.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  const msgs = data?.messages ?? [];
  const lastUser = [...msgs].reverse().find(m => m.role === 'user');
  const lastReply = msgs.length && msgs[msgs.length - 1]!.role === 'assistant' ? msgs[msgs.length - 1]! : null;
  const focusTitle = focus && (focus.kind === 'project' ? data?.projects.find(p => p.id === focus.id)?.title : focus.kind === 'idea' ? data?.ideas.find(p => p.id === focus.id)?.title : data?.notes.find(p => p.id === focus.id)?.title);
  const KIND = { idea: 'ideia', project: 'projeto', note: 'anotação', decision: 'decisão' } as const;

  return <GlassScreen scroll={false}>
    <View style={{ height: 64 }}>
      <Animated.View style={[fill, { opacity: rest, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, only(!talking)]}>
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, fontWeight: '600', letterSpacing: -0.6 }}>STARK</Text>
          <Text style={{ color: c.muted, fontSize: 16 }}>Seu assistente pessoal.</Text>
        </View>
        <RoundButton icon="gear" label="Abrir configurações" onPress={() => router.push('/settings')} />
      </Animated.View>
      <Animated.View style={[fill, { opacity: talk, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, only(talking)]}>
        <View style={{ height: 48, justifyContent: 'center' }}><Icon name="wave" size={30} color={c.accent} /></View>
        <RoundButton icon="x" label="Fechar conversa" onPress={close} />
      </Animated.View>
    </View>

    {dataError && <View style={{ gap: 12 }}>
      <Notice text={dataError} />
      {unreadable ? <GlassButton title="Ver opções em Configurações" onPress={() => router.push('/settings')} /> : <GlassButton title="Tentar novamente" onPress={() => void reload()} />}
    </View>}

    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={talking ? 'Esfera: tocar para falar ou interromper' : 'Tocar para conversar'}
        onPress={() => (talking ? convo.press() : open(true))} hitSlop={12} style={{ width: base, height: base, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Sphere size={base} colors={sphere.colors} mode={SPHERE_MODE[convo.phase]} dark={mode === 'dark'} active={focused} />
        </Animated.View>
      </Pressable>
    </View>

    <View style={{ height: lowerH }}>
      <Animated.View style={[fill, { opacity: rest, alignItems: 'center' }, only(!talking)]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Toque para conversar" onPress={() => open(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
          <Icon name="wave" size={22} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 18 }}>Toque para conversar</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={[fill, { opacity: talk }, only(talking)]}>
        <ScrollView contentContainerStyle={{ gap: 10, alignItems: 'stretch', paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          {focus && !!focusTitle && <Pressable accessibilityRole="button" accessibilityLabel={`Parar de discutir: ${focusTitle}`} onPress={() => setFocus(null)} style={{ alignSelf: 'center' }}>
            <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text numberOfLines={1} style={{ color: c.muted, fontSize: 14, maxWidth: 240 }}>Discutindo: {focusTitle}</Text><Icon name="x" size={14} color={c.muted} />
            </Glass>
          </Pressable>}
          <Text accessibilityLiveRegion="polite" style={{ color: convo.phase === 'idle' ? c.muted : c.text, fontSize: convo.phase === 'idle' ? 15 : 18, textAlign: 'center', fontWeight: convo.phase === 'idle' ? '400' : '500' }}>
            {status(convo.phase, convo.interim, convo.support)}
          </Text>
          {convo.phase === 'idle' && lastUser && <Text numberOfLines={2} style={{ color: c.faint, fontSize: 14, textAlign: 'center' }}>Você: {lastUser.text}</Text>}
          {convo.phase !== 'listening' && lastReply && <>
            <Text style={{ color: c.text, fontSize: 17, lineHeight: 25, textAlign: 'center' }}>{lastReply.text}</Text>
            {convo.phase === 'idle' && convo.support.synthesis && <Pressable accessibilityRole="button" accessibilityLabel="Ouvir a resposta" onPress={() => convo.speakReply(lastReply.text)} style={{ alignSelf: 'center', padding: 6 }}>
              <Text style={{ color: c.accent, fontSize: 15, fontWeight: '600' }}>Ouvir resposta</Text></Pressable>}
          </>}
          {convo.pending.map(p => <Glass key={p.id} radius={20} strong style={{ padding: 14, gap: 10 }}>
            <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>
              {p.draft.kind === 'decision' ? `Registrar decisão em “${data?.projects.find(x => x.id === p.draft.projectId)?.title ?? 'projeto'}”: ${p.draft.body}` : `Salvar como ${KIND[p.draft.kind]}: ${p.draft.title}`}
            </Text>
            {p.draft.kind !== 'decision' && !!p.draft.body && <Text numberOfLines={2} style={{ color: c.muted, fontSize: 14 }}>{p.draft.body}</Text>}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Salvar ${KIND[p.draft.kind]}`} onPress={() => void convo.accept(p)} style={{ flex: 1, minHeight: 44, borderRadius: 16, borderWidth: 1, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.text, fontWeight: '600' }}>Salvar</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Dispensar sugestão" onPress={() => convo.dismiss(p.id)} style={{ flex: 1, minHeight: 44, borderRadius: 16, borderWidth: 1, borderColor: c.glassBorder, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.muted }}>Dispensar</Text></Pressable>
            </View>
          </Glass>)}
          {convo.remembered.map(r => <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Text numberOfLines={1} style={{ color: c.faint, fontSize: 14, flexShrink: 1 }}>Memorizado: {r.text}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Desfazer memória: ${r.text}`} onPress={() => void convo.undo(r)}><Text style={{ color: c.accent, fontSize: 14, fontWeight: '600' }}>Desfazer</Text></Pressable>
          </View>)}
          {!!convo.notice && <Text accessibilityLiveRegion="polite" style={{ color: c.accent, fontSize: 15, textAlign: 'center' }}>{convo.notice}</Text>}
          {!!convo.error && <View style={{ gap: 8 }}>
            <Notice text={convo.error} />
            {convo.canRetry && <GlassButton title="Tentar de novo" onPress={convo.retry} />}
            {/código de acesso/i.test(convo.error) && <GlassButton title="Abrir configurações" onPress={() => router.push('/settings')} />}
          </View>}
        </ScrollView>
      </Animated.View>
    </View>

    <View style={{ height: 88 }}>
      <Animated.View style={[fill, { opacity: rest, justifyContent: 'flex-end' }, only(!talking)]}>
        <Glass radius={44} style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10 }}>
          {MENU.map(item => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => router.push(`/${item.id}`)}
              style={({ pressed }) => ({ width: 64, height: 56, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Icon name={item.icon} size={28} color={c.text} />
            </Pressable>
          ))}
        </Glass>
      </Animated.View>
      <Animated.View style={[fill, { opacity: talk, justifyContent: 'flex-end' }, only(talking)]}>
        <Glass radius={34} strong style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, paddingVertical: 8, gap: 6 }}>
          <TextInput accessibilityLabel="Mensagem para o STARK" value={draft} onChangeText={setDraft} onSubmitEditing={submit} returnKeyType="send" editable={convo.phase !== 'thinking'}
            placeholder="Escreva para o STARK…" placeholderTextColor={c.faint} style={[{ flex: 1, color: c.text, fontSize: 17, minHeight: 46 }, noOutline]} />
          {convo.support.recognition && <RoundButton icon="mic" size={46} label={convo.phase === 'listening' ? 'Parar de ouvir' : 'Falar com o STARK'} onPress={convo.press} />}
          <RoundButton icon="send" size={46} label="Enviar mensagem" disabled={!draft.trim() || convo.phase === 'thinking'} onPress={submit} />
        </Glass>
      </Animated.View>
    </View>
  </GlassScreen>;
}
