import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useNavigation } from 'expo-router';

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Telas empilhadas continuam montadas; isto permite pausar animações pesadas nas que estão ocultas. */
export function useScreenFocused() {
  const nav = useNavigation();
  const [focused, setFocused] = useState(() => nav.isFocused());
  useEffect(() => {
    const a = nav.addListener('focus', () => setFocused(true));
    const b = nav.addListener('blur', () => setFocused(false));
    return () => { a(); b(); };
  }, [nav]);
  return focused;
}
