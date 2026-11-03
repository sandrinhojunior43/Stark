import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LocalStateProvider } from '../src/data/LocalStateProvider';
import { GlassButton, GlassScreen, Sub, Title } from '../src/ui/glass';
import { useTheme } from '../src/ui/theme';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <GlassScreen><Title>Vamos tentar de novo.</Title><Sub>Não foi possível abrir esta tela.</Sub><GlassButton title="Tentar novamente" onPress={retry} /></GlassScreen>;
}

function Shell() {
  const { mode, c } = useTheme();
  return <>
    <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg[0] }, animation: 'fade' }} />
  </>;
}

export default function RootLayout() {
  return <LocalStateProvider><Shell /></LocalStateProvider>;
}
