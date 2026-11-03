import { SphereSvg } from './SphereSvg';
import type { SphereProps } from './sphere-types';
export type { SphereProps, SphereMode } from './sphere-types';
// Build nativo: desenho em SVG. A versão com WebGL está em Sphere.web.tsx.
export function Sphere(props: SphereProps) { return <SphereSvg {...props} />; }
