import type { Voice } from './index';

// Contratos para as próximas fases. Nenhuma implementação ou chamada paga existe ainda.
// Quando houver provedores, as chaves ficam em uma função serverless sem estado (ex.: Vercel),
// que recebe o contexto enviado pelo aparelho e não guarda memória nem histórico.
// A camada de raciocínio não recebe a preferência de voz.
export interface AssistantInput {
  userId: string;
  contextId: string;
  text: string;
  authorizedContext: readonly string[];
}
export interface LanguageModel { respond(input: AssistantInput, signal: AbortSignal): AsyncIterable<string> }
export interface Transcriber { transcribe(audio: AsyncIterable<Uint8Array>, signal: AbortSignal): AsyncIterable<string> }
export interface SpeechSynthesizer { speak(text: string, preset: Voice, signal: AbortSignal): AsyncIterable<Uint8Array> }
export const integrationStatus = { language: 'disabled', transcription: 'disabled', synthesis: 'disabled' } as const;

export const voicePresets: Record<Voice, { label: string; locale: 'pt-BR'; direction: string; providerVoiceId: null }> = {
  wells: { label: 'Wells', locale: 'pt-BR', direction: 'Grave, controlada, articulada, elegante.', providerVoiceId: null },
  stark: { label: 'Stark', locale: 'pt-BR', direction: 'Confiante, dinâmica, espontânea, espirituosa.', providerVoiceId: null },
};
// IDs de fornecedor só serão definidos após aprovação de vozes originais e direitos de uso.
