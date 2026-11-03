import type { SphereMode } from './sphere-gl';
export type { SphereMode };
export interface SphereProps {
  size: number;
  colors: readonly [string, string, string];
  mode: SphereMode;
  dark: boolean;
  /** Pausa a animação quando a tela está oculta. */
  active?: boolean;
}
