import { useEffect, useId, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { SPHERE_PRESETS, THEMES, THEME_LABELS, VOICES, VOICE_LABELS, type SpherePreset } from '@stark/contracts';
import { useLocalState } from '../src/data/LocalStateProvider';
import { canImportBackup } from '../src/data/device';
import { getAccessCode, setAccessCode } from '../src/data/access';
import { ChatError, getStatus } from '../src/chat/client';
import { cancelSpeech, recognitionSupported, speak, synthesisSupported } from '../src/chat/speech';
import { BackButton, Glass, GlassButton, GlassScreen, Label, Notice, Sub, Title, TopBar } from '../src/ui/glass';
import { Icon } from '../src/ui/icons';
import { useScreenFocused } from '../src/ui/hooks';
import { Sphere } from '../src/ui/Sphere';
import { SPHERES, useTheme } from '../src/ui/theme';
import type { ChatStatus } from '@stark/contracts';

const DESCRIPTIONS = { wells: 'Grave, ponderada e elegante.', stark: 'Dinâmica, espontânea e confiante.' } as const;

function describeStatus(s: ChatStatus): { ok: boolean; text: string } {
  if (!s.configured.apiKey) return { ok: false, text: 'O servidor ainda não tem a chave do serviço de IA (variável ANTHROPIC_API_KEY na Vercel).' };
  if (!s.configured.accessCode) return { ok: false, text: 'O servidor ainda não tem um código de acesso (variável STARK_ACCESS_CODE na Vercel).' };
  if (s.authorized === null) return { ok: false, text: 'Digite o código de acesso para testar.' };
  if (!s.authorized) return { ok: false, text: 'Código de acesso incorreto.' };
  return { ok: true, text: `Conexão pronta (modelo ${s.model}). A primeira conversa confirma se a chave do serviço de IA é válida.` };
}

function storageText(s: ReturnType<typeof useLocalState>['status']) {
  if (!s) return 'Verificando o armazenamento…';
  if (s.kind === 'securestore') return 'Seus dados ficam no armazenamento seguro deste aparelho.';
  if (s.persisted) return 'Seus dados ficam neste navegador, e ele aceitou mantê-los guardados.';
  if (!s.installed) return 'Seus dados ficam neste navegador. Adicione o STARK à tela de início para reduzir o risco de o navegador apagá-los, e exporte backups com frequência.';
  return 'Seus dados ficam neste aparelho. Exporte backups com frequência: limpar os dados do navegador ou trocar de aparelho apaga tudo.';
}

function Swatch({ preset, selected, disabled, onPress }: { preset: SpherePreset; selected: boolean; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [a, b, d] = SPHERES[preset].colors;
  return <Pressable accessibilityRole="radio" accessibilityLabel={`Cores ${SPHERES[preset].label}`} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress}
    style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.glassBorder, opacity: disabled ? 0.5 : 1 }}>
    <Svg width={34} height={34}><Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <Stop offset="0" stopColor={a} /><Stop offset="0.55" stopColor={b} /><Stop offset="1" stopColor={d} />
    </LinearGradient></Defs><Circle cx={17} cy={17} r={16} fill={`url(#${id})`} /></Svg>
  </Pressable>;
}

function VolumeSlider({ value, disabled, onCommit }: { value: number; disabled: boolean; onCommit: (v: number) => void }) {
  const { c } = useTheme();
  const [drag, setDrag] = useState<number | null>(null);
  const width = useRef(1);
  const left = useRef(0);
  const track = useRef<{ measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null>(null);
  const latest = useRef<number | null>(null);
  const measure = () => track.current?.measureInWindow((x, _y, w) => { left.current = x; if (w > 0) width.current = w; });
  // Usa a posição na janela (pageX): locationX varia conforme o elemento tocado.
  const at = (e: GestureResponderEvent) => {
    const ratio = (e.nativeEvent.pageX - left.current) / width.current;
    return Number.isFinite(ratio) ? Math.round(Math.min(1, Math.max(0, ratio)) * 20) * 5 : null;
  };
  const begin = (e: GestureResponderEvent) => { measure(); latest.current = at(e); if (latest.current !== null) setDrag(latest.current); };
  const shown = drag ?? value;
  const step = (d: number) => onCommit(Math.min(100, Math.max(0, value + d)));
  return <View accessibilityRole="adjustable" accessibilityLabel="Volume da voz" accessibilityValue={{ min: 0, max: 100, now: shown }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={e => step(e.nativeEvent.actionName === 'increment' ? 5 : -5)}
    ref={n => { track.current = n as unknown as typeof track.current; }}
    onLayout={e => { width.current = Math.max(1, e.nativeEvent.layout.width); measure(); }}
    onStartShouldSetResponder={() => !disabled}
    onResponderGrant={begin}
    onResponderMove={e => { const v = at(e); if (v !== null) { latest.current = v; setDrag(v); } }}
    onResponderRelease={() => { if (latest.current !== null) onCommit(latest.current); latest.current = null; setDrag(null); }}
    onResponderTerminate={() => { latest.current = null; setDrag(null); }}
    style={{ height: 44, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
    <View pointerEvents="none" style={{ height: 8, borderRadius: 4, backgroundColor: c.hairline, justifyContent: 'center' }}>
      <View style={{ width: `${shown}%`, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
      <View style={{ position: 'absolute', left: `${shown}%`, marginLeft: -13, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: c.glassBorder }} />
    </View>
  </View>;
}

export default function Settings() {
  const { c, mode, sphere } = useTheme();
  const { preferences, status, loading, saving, error, unreadable, reload, setPreferences, selectVoice, exportBackup, importBackup, eraseDevice } = useLocalState();
  const focused = useScreenFocused();
  const off = loading || saving || !preferences;
  const [code, setCode] = useState('');
  const [savedCode, setSavedCode] = useState('');
  const [conn, setConn] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => { void getAccessCode().then(v => { setCode(v); setSavedCode(v); }); }, []);
  const saveCode = async () => { const v = code.trim(); await setAccessCode(v); setSavedCode(v); setCode(v); setConn({ ok: true, text: v ? 'Código salvo neste aparelho.' : 'Código removido.' }); };
  const testConn = async () => {
    setTesting(true); setConn(null);
    try { setConn(describeStatus(await getStatus(code.trim()))); }
    catch (e) { setConn({ ok: false, text: e instanceof ChatError ? e.message : 'Falha ao testar a conexão.' }); }
    finally { setTesting(false); }
  };
  const testVoice = () => {
    if (!preferences) return;
    cancelSpeech();
    if (!speak('Olá. Eu sou o STARK. Como posso ajudar?', { voice: preferences.voice, volume: preferences.volume })) setConn({ ok: false, text: 'Este navegador não oferece síntese de voz.' });
  };
  const divider = <View style={{ height: 1, backgroundColor: c.hairline, marginLeft: 20 }} />;

  return <GlassScreen>
    <TopBar left={<BackButton />} />
    <Title>Configurações</Title>

    <View style={{ alignItems: 'center', height: 150, justifyContent: 'center' }}>
      <Sphere size={120} colors={sphere.colors} mode="rest" dark={mode === 'dark'} active={focused} />
    </View>

    <View style={{ gap: 8 }}>
      <Label>Voz</Label>
      <Glass>
        <View accessibilityRole="radiogroup">
          {VOICES.map((voice, i) => {
            const selected = preferences?.voice === voice;
            return <View key={voice}>
              {i > 0 && divider}
              <Pressable accessibilityRole="radio" accessibilityLabel={`Voz ${VOICE_LABELS[voice]}`} accessibilityState={{ checked: selected, disabled: off }} disabled={off}
                onPress={() => void selectVoice(voice)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, opacity: off ? 0.6 : 1 }}>
                <View style={{ gap: 4, flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{VOICE_LABELS[voice]}</Text>
                  <Text style={{ color: c.muted, fontSize: 15 }}>{DESCRIPTIONS[voice]}</Text>
                </View>
                {selected && <Icon name="check" size={24} color={c.accent} strokeWidth={2.2} />}
              </Pressable>
            </View>;
          })}
        </View>
      </Glass>
      <Text accessibilityLiveRegion="polite" style={{ color: c.faint, fontSize: 14, marginLeft: 6, lineHeight: 20 }}>
        {saving ? 'Salvando…' : 'A troca de voz não reinicia o assistente. Por enquanto a voz usa o sintetizador do seu navegador, com tom e ritmo próprios de cada opção; as vozes originais Wells e Stark virão com um serviço de voz dedicado.'}
      </Text>
    </View>

    <View style={{ gap: 8 }}>
      <Label>Aparência</Label>
      <Glass style={{ padding: 20, gap: 18 }}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>Tema</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
            {THEMES.map(t => {
              const selected = preferences?.theme === t;
              return <Pressable key={t} accessibilityRole="radio" accessibilityLabel={`Tema ${THEME_LABELS[t]}`} accessibilityState={{ checked: selected, disabled: off }} disabled={off}
                onPress={() => void setPreferences({ theme: t })}
                style={{ flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: selected ? 2 : 1, borderColor: selected ? c.accent : c.glassBorder,
                  backgroundColor: selected ? c.glassFillStrong : 'transparent', opacity: off ? 0.6 : 1 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: selected ? '600' : '400' }}>{THEME_LABELS[t]}</Text>
              </Pressable>;
            })}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>Cores da esfera</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {SPHERE_PRESETS.map(p => <Swatch key={p} preset={p} selected={preferences?.sphere === p} disabled={off} onPress={() => void setPreferences({ sphere: p })} />)}
          </View>
          <Text style={{ color: c.muted, fontSize: 15 }}>{sphere.label}</Text>
        </View>
      </Glass>
    </View>

    <View style={{ gap: 8 }}>
      <Label>Volume</Label>
      <Glass style={{ padding: 20, gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>Volume da voz</Text>
          <Text style={{ color: c.muted, fontSize: 16 }}>{preferences?.volume ?? '–'}%</Text>
        </View>
        <VolumeSlider value={preferences?.volume ?? 80} disabled={off} onCommit={v => void setPreferences({ volume: v })} />
        <Text style={{ color: c.faint, fontSize: 14 }}>Vale para a fala do STARK.</Text>
      </Glass>
    </View>

    {error && <View style={{ gap: 12 }}><Notice text={error} />{!unreadable && <GlassButton title="Recarregar" disabled={saving} onPress={() => void reload()} />}</View>}

    <View style={{ gap: 8 }}>
      <Label>Conversa</Label>
      <Glass style={{ padding: 20, gap: 14 }}>
        <Sub>Para conversar, o STARK usa um serviço de IA configurado no servidor. Digite aqui o código de acesso que você definiu lá.</Sub>
        <Glass radius={20}>
          <TextInput accessibilityLabel="Código de acesso" value={code} onChangeText={setCode} secureTextEntry autoCapitalize="none" autoCorrect={false}
            placeholder="Código de acesso" placeholderTextColor={c.faint} style={{ color: c.text, fontSize: 17, padding: 16, minHeight: 54 }} />
        </Glass>
        <GlassButton title="Salvar código" tone="primary" disabled={code.trim() === savedCode} onPress={() => void saveCode()} />
        <GlassButton title={testing ? 'Testando…' : 'Testar conexão'} disabled={testing} onPress={() => void testConn()} />
        {conn && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: conn.ok ? c.accent : c.dangerText, fontSize: 15, lineHeight: 22 }}>{conn.text}</Text>}
        <Text style={{ color: c.faint, fontSize: 14, lineHeight: 20 }}>
          Reconhecimento de voz: {recognitionSupported() ? 'disponível neste navegador.' : 'indisponível neste navegador (o Firefox não o oferece; use o texto).'} Fala: {synthesisSupported() ? 'disponível.' : 'indisponível.'}
        </Text>
        <GlassButton title="Ouvir amostra da voz" disabled={!preferences || !synthesisSupported()} onPress={testVoice} />
        <Text style={{ color: c.faint, fontSize: 14, lineHeight: 20 }}>
          Ao conversar, o texto das mensagens e um resumo de projetos, ideias, anotações e memórias vão para o serviço de IA. No Chrome, o reconhecimento de voz também envia o áudio ao Google.
        </Text>
        <GlassButton title="Ver memória do STARK" onPress={() => router.push('/memory')} />
      </Glass>
    </View>

    <View style={{ gap: 8 }}>
      <Label>Seus dados</Label>
      <Glass style={{ padding: 20, gap: 14 }}>
        <Sub>{storageText(status)}</Sub>
        <Text style={{ color: c.faint, fontSize: 14, lineHeight: 20 }}>Não há conta nem servidor. O backup é um arquivo que só você guarda.</Text>
        <GlassButton title="Exportar backup" tone="primary" disabled={!preferences || saving} onPress={() => void exportBackup()} />
        {canImportBackup && <GlassButton title="Restaurar backup" disabled={saving || loading} onPress={() => void importBackup()} />}
        <GlassButton tone="danger" title={unreadable ? 'Apagar dados ilegíveis e recomeçar' : 'Apagar dados deste aparelho'} disabled={saving || loading} onPress={() => void eraseDevice()} />
      </Glass>
    </View>
  </GlassScreen>;
}
