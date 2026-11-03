import { useEffect, useId, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { SphereProps } from './sphere-types';

/** Desenho em SVG: usado no app nativo e como reserva quando o WebGL não está disponível. */
export function SphereSvg({ size, colors, mode, dark, active = true }: SphereProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const period = mode === 'rest' ? 3200 : 1500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(breathe, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, mode, breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.985, mode === 'rest' ? 1.02 : 1.06] });
  const box = size * 1.6;
  const [c0, c1, c2] = colors;
  return <View pointerEvents="none" style={{ width: size, height: size }}>
    <Animated.View style={{ position: 'absolute', width: box, height: box, left: -(box - size) / 2, top: -(box - size) / 2, transform: [{ scale }] }}>
      <Svg width={box} height={box} viewBox="0 0 160 160">
        <Defs>
          <RadialGradient id={`h${id}`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0.5" stopColor={c1} stopOpacity={0.35} /><Stop offset="1" stopColor={c1} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`b${id}`} cx="0.36" cy="0.30" r="0.85">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} /><Stop offset="0.16" stopColor={c0} stopOpacity={0.85} />
            <Stop offset="0.55" stopColor={c1} stopOpacity={0.55} /><Stop offset="0.85" stopColor={c0} stopOpacity={0.5} />
            <Stop offset="1" stopColor={c2} stopOpacity={0.85} />
          </RadialGradient>
          <LinearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={dark ? 0.7 : 0.9} /><Stop offset="1" stopColor={c2} stopOpacity={0.7} />
          </LinearGradient>
        </Defs>
        <Circle cx={80} cy={80} r={64} fill={`url(#h${id})`} />
        <Ellipse cx={80} cy={131} rx={40} ry={6} fill={c2} opacity={0.25} />
        <Circle cx={80} cy={80} r={46.4} fill={`url(#b${id})`} />
        <Path d="M42 92 C 58 62, 98 122, 118 76" stroke={c2} strokeOpacity={0.55} strokeWidth={5} fill="none" strokeLinecap="round" />
        <Path d="M50 66 C 74 84, 92 50, 112 92" stroke={c0} strokeOpacity={0.5} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Circle cx={80} cy={80} r={46.4} fill="none" stroke={`url(#r${id})`} strokeWidth={1.6} />
        <Ellipse cx={64} cy={58} rx={14} ry={8} fill="#FFFFFF" opacity={0.5} transform="rotate(-28 64 58)" />
      </Svg>
    </Animated.View>
  </View>;
}
