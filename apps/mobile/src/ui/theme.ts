import type { SpherePreset, Theme } from '@stark/contracts';
import { useLocalStateOptional } from '../data/LocalStateProvider';

export interface Palette {
  bg: readonly [string, string, string];
  glowA: string; glowAOpacity: number; glowB: string; glowBOpacity: number;
  text: string; muted: string; faint: string; accent: string;
  glassFill: string; glassFillStrong: string; glassBorder: string; glassHi: string; hairline: string;
  dangerBg: string; dangerText: string;
}

export const palettes: Record<Theme, Palette> = {
  dark: {
    bg: ['#04081A', '#0A1030', '#1B1A4A'],
    glowA: '#7A63F0', glowAOpacity: 0.55, glowB: '#2468E8', glowBOpacity: 0.32,
    text: '#F1F5FF', muted: 'rgba(214,224,255,0.66)', faint: 'rgba(214,224,255,0.42)', accent: '#9DB8FF',
    glassFill: 'rgba(255,255,255,0.07)', glassFillStrong: 'rgba(255,255,255,0.14)',
    glassBorder: 'rgba(255,255,255,0.18)', glassHi: 'rgba(255,255,255,0.9)', hairline: 'rgba(255,255,255,0.10)',
    dangerBg: 'rgba(255,120,100,0.14)', dangerText: '#FFB8AA',
  },
  light: {
    bg: ['#F6F8FD', '#E9F0FB', '#EFEAFA'],
    glowA: '#B3A2F5', glowAOpacity: 0.55, glowB: '#9CC4FF', glowBOpacity: 0.45,
    text: '#14233A', muted: '#51647C', faint: '#8394A9', accent: '#3559C7',
    glassFill: 'rgba(255,255,255,0.55)', glassFillStrong: 'rgba(255,255,255,0.85)',
    glassBorder: 'rgba(20,35,58,0.10)', glassHi: 'rgba(255,255,255,1)', hairline: 'rgba(20,35,58,0.08)',
    dangerBg: '#FFF1EB', dangerText: '#8A352C',
  },
};

export const SPHERES: Record<SpherePreset, { label: string; colors: readonly [string, string, string] }> = {
  aurora: { label: 'Aurora', colors: ['#3D78FF', '#8C62F2', '#FFA862'] },
  oceano: { label: 'Oceano', colors: ['#1FA2FF', '#12D8C8', '#9BE7FF'] },
  poente: { label: 'Pôr do sol', colors: ['#FF6B6B', '#C84BD8', '#FFC857'] },
  esmeralda: { label: 'Esmeralda', colors: ['#1FCB8A', '#2F8CFF', '#E8F76A'] },
  grafite: { label: 'Grafite', colors: ['#8EA0B8', '#5B6B85', '#E6EEF8'] },
};

export function useTheme() {
  const ctx = useLocalStateOptional();
  const prefs = ctx?.preferences ?? null;
  const mode: Theme = prefs?.theme ?? 'dark';
  return { mode, c: palettes[mode], sphere: SPHERES[prefs?.sphere ?? 'aurora'] };
}
