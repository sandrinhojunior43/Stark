import { useId, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinear, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, type IconName } from './icons';
import { useTheme } from './theme';

const webBlur: ViewStyle = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)' } as ViewStyle) : {};

export function Backdrop() {
  const { c } = useTheme();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
    <Defs>
      <SvgLinear id={`bg${id}`} x1="0" y1="0" x2="0.35" y2="1">
        {c.bg.map((col, i) => <Stop key={i} offset={i / 2} stopColor={col} />)}
      </SvgLinear>
      <RadialGradient id={`a${id}`} cx="0.92" cy="0.98" r="0.78">
        <Stop offset="0" stopColor={c.glowA} stopOpacity={c.glowAOpacity} /><Stop offset="1" stopColor={c.glowA} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id={`b${id}`} cx="0.05" cy="0.1" r="0.65">
        <Stop offset="0" stopColor={c.glowB} stopOpacity={c.glowBOpacity} /><Stop offset="1" stopColor={c.glowB} stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Rect width="100%" height="100%" fill={`url(#bg${id})`} />
    <Rect width="100%" height="100%" fill={`url(#a${id})`} />
    <Rect width="100%" height="100%" fill={`url(#b${id})`} />
  </Svg>;
}

export function GlassScreen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.bg[0] }}>
    <Backdrop />
    <SafeAreaView style={{ flex: 1 }}>
      {scroll
        ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
        : <View style={[styles.content, { flex: 1 }]}>{children}</View>}
    </SafeAreaView>
  </View>;
}

export function Glass({ children, style, radius = 28, strong = false }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; radius?: number; strong?: boolean }>) {
  const { c } = useTheme();
  return <View style={[{ borderRadius: radius, borderWidth: 1, borderColor: c.glassBorder, overflow: 'hidden',
    backgroundColor: strong ? c.glassFillStrong : c.glassFill }, webBlur, style]}>
    <LinearGradient pointerEvents="none" colors={[c.glassHi, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.9 }} style={[StyleSheet.absoluteFill, { opacity: 0.16 }]} />
    {children}
  </View>;
}

export function RoundButton({ icon, label, onPress, size = 48, disabled = false }: { icon: IconName; label: string; onPress?: () => void; size?: number; disabled?: boolean }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
    <Glass radius={size / 2} strong style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={c.text} />
    </Glass>
  </Pressable>;
}

export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
export function BackButton() {
  return <RoundButton icon="back" label="Voltar" onPress={goBack} />;
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
    <View>{left}</View><View>{right}</View>
  </View>;
}

export function GlassButton({ title, onPress, disabled = false, tone = 'default' }: { title: string; onPress: () => void; disabled?: boolean; tone?: 'default' | 'primary' | 'danger' }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}>
    <Glass radius={20} strong={tone === 'primary'} style={{ minHeight: 52, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
      ...(tone === 'primary' ? { borderColor: c.accent } : {}) }}>
      <Text style={{ color: tone === 'danger' ? c.dangerText : c.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Glass>
  </Pressable>;
}

export function Title({ children }: PropsWithChildren) {
  const { c } = useTheme();
  return <Text accessibilityRole="header" style={{ color: c.text, fontSize: 32, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 }}>{children}</Text>;
}
export function Sub({ children, center = false }: PropsWithChildren<{ center?: boolean }>) {
  const { c } = useTheme();
  return <Text style={{ color: c.muted, fontSize: 16, lineHeight: 24, textAlign: center ? 'center' : 'left' }}>{children}</Text>;
}
export function Label({ children }: PropsWithChildren) {
  const { c } = useTheme();
  return <Text style={{ color: c.faint, fontSize: 14, fontWeight: '600', marginLeft: 6 }}>{children}</Text>;
}
export function Notice({ text }: { text: string }) {
  const { c } = useTheme();
  return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: c.dangerText, backgroundColor: c.dangerBg, padding: 16, borderRadius: 18, lineHeight: 22, overflow: 'hidden' }}>{text}</Text>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 20 },
});
