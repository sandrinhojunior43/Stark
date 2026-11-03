import type { Voice } from '@stark/contracts';
import { speechText, splitSentences } from './text';

// Fala e reconhecimento do navegador (Chrome e Firefox). Reconhecimento de voz só existe no Chrome/Edge/Safari;
// o Firefox não o oferece, e a conversa por texto cobre esse caso.
interface RecognitionEvent { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;
const win = () => (typeof window === 'undefined' ? undefined : (window as unknown as Window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }));

export const recognitionSupported = () => { const w = win(); return !!(w?.SpeechRecognition ?? w?.webkitSpeechRecognition); };
export const synthesisSupported = () => !!win()?.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';

export interface Recognizer { start(): void; stop(): void; abort(): void }
export interface RecognizerHandlers { onInterim(text: string): void; onFinal(text: string): void; onEnd(): void; onError(code: string): void }

export function createRecognizer(h: RecognizerHandlers): Recognizer | null {
  const w = win();
  const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = true;
  let finalText = '';
  let errored = false;
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]!;
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) finalText += t; else interim += t;
    }
    h.onInterim((finalText + interim).trim());
  };
  rec.onerror = e => { errored = true; h.onError(e.error); };
  rec.onend = () => {
    if (!errored && finalText.trim()) h.onFinal(finalText.trim());
    h.onEnd();
  };
  return { start: () => rec.start(), stop: () => rec.stop(), abort: () => { errored = true; rec.abort(); } };
}

/** Predefinições provisórias. As vozes originais Wells/Stark exigirão um serviço de síntese próprio. */
export const VOICE_PRESETS: Record<Voice, { pitch: number; rate: number }> = {
  wells: { pitch: 0.8, rate: 0.92 },
  stark: { pitch: 1.05, rate: 1.1 },
};

function pickVoice(voice: Voice): SpeechSynthesisVoice | null {
  const all = win()?.speechSynthesis.getVoices() ?? [];
  const pt = all.filter(v => /^pt[-_]br/i.test(v.lang)).sort((a, b) => a.name.localeCompare(b.name));
  const any = pt.length ? pt : all.filter(v => /^pt/i.test(v.lang)).sort((a, b) => a.name.localeCompare(b.name));
  if (!any.length) return null;
  return voice === 'wells' ? any[0]! : any[any.length > 1 ? 1 : 0]!;
}

export interface SpeakOptions { voice: Voice; volume: number; onStart?: () => void; onEnd?: () => void; onError?: () => void }

export function cancelSpeech() { win()?.speechSynthesis?.cancel(); }

export function speak(input: string, o: SpeakOptions): { cancel: () => void } | null {
  if (!synthesisSupported()) return null;
  const synth = win()!.speechSynthesis;
  const chunks = splitSentences(speechText(input));
  synth.cancel();
  if (!chunks.length) { o.onEnd?.(); return { cancel() {} }; }
  const preset = VOICE_PRESETS[o.voice];
  const chosen = pickVoice(o.voice);
  let cancelled = false;
  const next = (i: number) => {
    if (cancelled) return;
    if (i >= chunks.length) { o.onEnd?.(); return; }
    const u = new SpeechSynthesisUtterance(chunks[i]!);
    u.lang = 'pt-BR'; u.pitch = preset.pitch; u.rate = preset.rate; u.volume = Math.min(1, Math.max(0, o.volume / 100));
    if (chosen) u.voice = chosen;
    if (i === 0) u.onstart = () => o.onStart?.();
    u.onend = () => next(i + 1);
    u.onerror = e => { if (cancelled || e.error === 'interrupted' || e.error === 'canceled') return; o.onError?.(); };
    synth.speak(u);
  };
  next(0);
  return { cancel() { cancelled = true; synth.cancel(); } };
}
