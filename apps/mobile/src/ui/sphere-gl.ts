import { SPHERE_FRAG, SPHERE_VERT } from './sphere-shader';

export type SphereMode = 'rest' | 'listening' | 'processing' | 'speaking';
export interface SphereParams { time: number; amp: number; dark: boolean; colors: readonly [string, string, string] }
export interface SphereGL {
  draw(p: SphereParams): void;
  resize(cssSize: number, dpr: number): void;
  dispose(): void;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Retorna null se o WebGL não estiver disponível ou o shader falhar; quem chama usa o desenho SVG. */
export function createSphereGL(canvas: HTMLCanvasElement, onLost: () => void): SphereGL | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    console.warn('STARK: shader da esfera não compilou:', gl.getShaderInfoLog(s));
    return null;
  };
  const vs = compile(gl.VERTEX_SHADER, SPHERE_VERT);
  const fs = compile(gl.FRAGMENT_SHADER, SPHERE_FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uTime = u('uTime'), uAmp = u('uAmp'), uDark = u('uDark'), uC0 = u('uC0'), uC1 = u('uC1'), uC2 = u('uC2');
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); onLost(); });
  gl.clearColor(0, 0, 0, 0);
  return {
    draw(p) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, p.time); gl.uniform1f(uAmp, p.amp); gl.uniform1f(uDark, p.dark ? 1 : 0);
      gl.uniform3fv(uC0, rgb(p.colors[0])); gl.uniform3fv(uC1, rgb(p.colors[1])); gl.uniform3fv(uC2, rgb(p.colors[2]));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    resize(cssSize, dpr) {
      const px = Math.max(2, Math.round(cssSize * dpr));
      if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    },
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}

/** Movimento por estado. Hoje é sintético (sem microfone); quando houver áudio, `level` substitui a oscilação. */
export function createMotion() {
  let time = 0, amp = 0;
  return (mode: SphereMode, dt: number, level?: number) => {
    const speed = { rest: 0.6, listening: 0.9, processing: 1.8, speaking: 1.1 }[mode];
    time += dt * speed;
    const target = level ?? {
      rest: 0,
      listening: 0.35 + 0.2 * Math.sin(time * 3.1),
      processing: 0.15,
      speaking: 0.5 + 0.4 * Math.abs(Math.sin(time * 5) * Math.sin(time * 2.3)),
    }[mode];
    amp += (target - amp) * Math.min(1, dt * 6);
    return { time, amp };
  };
}
