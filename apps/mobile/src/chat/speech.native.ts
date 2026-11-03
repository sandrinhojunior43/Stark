import type { Voice } from '@stark/contracts';
// Build nativo: reconhecimento e fala do navegador não existem; a conversa por texto continua disponível.
export const recognitionSupported = () => false;
export const synthesisSupported = () => false;
export interface Recognizer { start(): void; stop(): void; abort(): void }
export interface RecognizerHandlers { onInterim(text: string): void; onFinal(text: string): void; onEnd(): void; onError(code: string): void }
export const createRecognizer = (_h: RecognizerHandlers): Recognizer | null => null;
export const VOICE_PRESETS: Record<Voice, { pitch: number; rate: number }> = { wells: { pitch: 0.8, rate: 0.92 }, stark: { pitch: 1.05, rate: 1.1 } };
export interface SpeakOptions { voice: Voice; volume: number; onStart?: () => void; onEnd?: () => void; onError?: () => void }
export const cancelSpeech = () => {};
export const speak = (_text: string, _o: SpeakOptions): { cancel: () => void } | null => null;
