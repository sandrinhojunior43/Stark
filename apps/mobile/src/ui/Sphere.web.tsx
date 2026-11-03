import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { createMotion, createSphereGL } from './sphere-gl';
import { SphereSvg } from './SphereSvg';
import type { SphereProps } from './sphere-types';
export type { SphereProps, SphereMode } from './sphere-types';

export function Sphere(props: SphereProps) {
  const host = useRef<HTMLElement | null>(null);
  const live = useRef(props);
  live.current = props;
  const kick = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    node.appendChild(canvas);
    const gl = createSphereGL(canvas, () => setFallback(true));
    if (!gl) { canvas.remove(); setFallback(true); return; }
    const motion = createMotion();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0, last = performance.now(), running = true;
    const frame = (now: number) => {
      const L = live.current;
      const css = L.size * 1.6;
      canvas.style.width = `${css}px`; canvas.style.height = `${css}px`;
      canvas.style.left = `${-(css - L.size) / 2}px`; canvas.style.top = `${-(css - L.size) / 2}px`;
      gl.resize(css, Math.min(window.devicePixelRatio || 1, 2));
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const m = reduced ? { time: 2, amp: 0 } : motion(L.mode, dt);
      gl.draw({ time: m.time + 2, amp: m.amp, dark: L.dark, colors: L.colors });
    };
    const loop = (now: number) => {
      if (!running) return;
      if (live.current.active !== false && !document.hidden) frame(now); else last = now;
      raf = requestAnimationFrame(loop);
    };
    kick.current = () => frame(performance.now());
    if (reduced) frame(performance.now()); else raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); gl.dispose(); canvas.remove(); };
  }, []);

  useEffect(() => { kick.current(); }, [props.size, props.colors, props.mode, props.dark, props.active]);

  if (fallback) return <SphereSvg {...props} />;
  return <View ref={n => { host.current = n as unknown as HTMLElement | null; }} pointerEvents="none" style={{ width: props.size, height: props.size }} />;
}
