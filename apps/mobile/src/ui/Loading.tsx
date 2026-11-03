import { ActivityIndicator } from 'react-native';
import { GlassScreen, Sub } from './glass';
import { useTheme } from './theme';
export function Loading() {
  const { c } = useTheme();
  return <GlassScreen><ActivityIndicator accessibilityLabel="Carregando" color={c.accent} /><Sub center>Um instante…</Sub></GlassScreen>;
}
