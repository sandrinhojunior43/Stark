import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextStyle } from 'react-native';
import { Icon, type IconName } from './icons';
import { BackButton, Glass, GlassScreen, Label, Sub, Title, TopBar } from './glass';
import { useTheme } from './theme';

const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

export function Field({ label, value, onChangeText, multiline = false, lines = 4, placeholder, maxLength }:
  { label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; lines?: number; placeholder?: string; maxLength?: number }) {
  const { c } = useTheme();
  return <View style={{ gap: 8 }}>
    <Label>{label}</Label>
    <Glass radius={22}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} placeholder={placeholder} placeholderTextColor={c.faint} maxLength={maxLength}
        style={[{ color: c.text, fontSize: 17, lineHeight: 24, padding: 16, minHeight: multiline ? lines * 24 + 32 : 54, textAlignVertical: multiline ? 'top' : 'center' }, noOutline]} />
    </Glass>
  </View>;
}

export function Chips({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const { c } = useTheme();
  return <View style={{ gap: 8 }}>
    <Label>{label}</Label>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const on = o.value === value;
        return <Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: on }} onPress={() => onChange(o.value)}
          style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.glassBorder, backgroundColor: on ? c.glassFillStrong : 'transparent' }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: on ? '600' : '400' }}>{o.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

export function Row({ icon, title, subtitle, meta, onPress }: { icon: IconName; title: string; subtitle?: string; meta?: string; onPress: () => void }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
    <Glass radius={26} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 18 }}>
      <Icon name={icon} size={28} color={c.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
        {!!subtitle && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 15 }}>{subtitle}</Text>}
        {!!meta && <Text style={{ color: c.faint, fontSize: 14, marginTop: 2 }}>{meta}</Text>}
      </View>
      <Icon name="chevron" size={18} color={c.muted} />
    </Glass>
  </Pressable>;
}

export function EditorScreen({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return <GlassScreen>
    <TopBar left={<BackButton />} />
    <View style={{ gap: 6 }}><Title>{title}</Title>{!!subtitle && <Sub>{subtitle}</Sub>}</View>
    {children}
  </GlassScreen>;
}

export function Message({ text, ok = false }: { text: string; ok?: boolean }) {
  const { c } = useTheme();
  return <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
    style={{ color: ok ? c.accent : c.dangerText, backgroundColor: ok ? c.glassFill : c.dangerBg, padding: 16, borderRadius: 18, lineHeight: 22, overflow: 'hidden' }}>{text}</Text>;
}

export function Missing({ what }: { what: string }) {
  return <EditorScreen title="Não encontrado" subtitle={`Esta ${what} não existe mais neste aparelho.`}>{null as ReactNode}</EditorScreen>;
}
