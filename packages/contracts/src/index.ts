export const ASSISTANT_ID = 'stark' as const;
export const VOICES = ['wells', 'stark'] as const;
export type Voice = (typeof VOICES)[number];
export const VOICE_LABELS: Record<Voice, string> = { wells: 'Wells', stark: 'Stark' };

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_LABELS: Record<Theme, string> = { dark: 'Escuro', light: 'Claro' };

export const SPHERE_PRESETS = ['aurora', 'oceano', 'poente', 'esmeralda', 'grafite'] as const;
export type SpherePreset = (typeof SPHERE_PRESETS)[number];

/** Preferências do aparelho. A voz é só uma delas: não cria outro assistente, contexto ou histórico. */
export interface Preferences { voice: Voice; theme: Theme; sphere: SpherePreset; volume: number }
export const DEFAULT_PREFERENCES: Preferences = { voice: 'wells', theme: 'dark', sphere: 'aurora', volume: 80 };

/** Identidade do assistente neste aparelho. */
export interface Me {
  userId: string;
  assistantId: typeof ASSISTANT_ID;
  contextId: string;
  memoryScope: string;
  historyScope: string;
  preferences: Preferences;
}

export const isVoice = (value: unknown): value is Voice => value === 'wells' || value === 'stark';
export const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';
export const isSpherePreset = (value: unknown): value is SpherePreset => (SPHERE_PRESETS as readonly unknown[]).includes(value);
export const isVolume = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;

export * from './ai';
export * from './domain';
export * from './chat';
