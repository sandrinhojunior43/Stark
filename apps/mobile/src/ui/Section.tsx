import type { PropsWithChildren } from 'react';
import { ScrollView, Text, TextInput, View, type TextStyle } from 'react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { Icon, type IconName } from './icons';
import { BackButton, Glass, GlassScreen, RoundButton, Sub, Title, TopBar } from './glass';
import { useTheme } from './theme';

const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

/** Molde das telas de seção: título, busca, lista (ou estado vazio) e botão de ação. */
export function Section({ icon, title, subtitle, emptyTitle, emptyBody, total, shown, query, onQuery, onAdd, addIcon = 'plus', addLabel, children }: PropsWithChildren<{
  icon: IconName; title: string; subtitle: string; emptyTitle: string; emptyBody: string;
  total: number; shown: number; query?: string; onQuery?: (q: string) => void; onAdd?: () => void; addIcon?: IconName; addLabel?: string;
}>) {
  const { c } = useTheme();
  return <GlassScreen scroll={false}>
    <TopBar left={<BackButton />} right={<RoundButton icon="gear" label="Abrir configurações" onPress={() => router.push('/settings')} />} />
    <View style={{ gap: 6 }}><Title>{title}</Title><Sub>{subtitle}</Sub></View>
    {onQuery && <Glass radius={26} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, minHeight: 54 }}>
      <Icon name="search" size={22} color={c.muted} />
      <TextInput value={query} onChangeText={onQuery} placeholder="Buscar…" placeholderTextColor={c.faint} accessibilityLabel="Buscar" style={[{ flex: 1, color: c.text, fontSize: 17 }, noOutline]} />
    </Glass>}
    {shown > 0
      ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: onAdd ? 96 : 24 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
      : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 12, paddingBottom: 60 }}>
          <Glass radius={46} style={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={36} color={c.muted} /></Glass>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '600', textAlign: 'center' }}>{total === 0 ? emptyTitle : 'Nada encontrado'}</Text>
          <Sub center>{total === 0 ? emptyBody : `Nenhum resultado para “${query?.trim()}”.`}</Sub>
        </View>}
    {onAdd && <View style={{ position: 'absolute', right: 24, bottom: 24 }}><RoundButton icon={addIcon} size={60} label={addLabel ?? 'Adicionar'} onPress={onAdd} /></View>}
  </GlassScreen>;
}
