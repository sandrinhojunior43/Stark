import { useEffect, useRef, useState } from 'react';
import type { ProposalDraft } from '@stark/contracts';
import { useLocalState } from '../data/LocalStateProvider';
import { addDecision, addIdea, addMemory, addNote, addProject, appendMessages, removeMemory } from '../data/actions';
import { getAccessCode } from '../data/access';
import { newId } from '../data/state';
import { ChatError, postChat } from './client';
import { buildContext, buildMessages, type Focus } from './context';
import { cancelSpeech, createRecognizer, recognitionSupported, speak, synthesisSupported, type Recognizer } from './speech';

export type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
export interface Pending { id: string; draft: ProposalDraft }
export interface Remembered { id: string; text: string }

const MIC_ERRORS: Record<string, string> = {
  'not-allowed': 'O navegador bloqueou o microfone. Libere o acesso nas permissões do site e tente de novo.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz. Libere o microfone nas permissões do site.',
  'no-speech': 'Não ouvi nada. Toque na esfera e fale de novo.',
  'audio-capture': 'Nenhum microfone foi encontrado neste aparelho.',
  network: 'O reconhecimento de voz do navegador precisa de internet.',
};
const SAVED = { idea: 'Ideia salva.', project: 'Projeto criado.', note: 'Anotação salva.', decision: 'Decisão registrada.' } as const;

/** Conversa com o STARK por voz ou texto. A voz escolhida só afeta a fala; o conteúdo enviado ao modelo não a inclui. */
export function useConversation(focus: Focus | null) {
  const { getData, preferences, mutate } = useLocalState();
  const [phase, setPhaseState] = useState<Phase>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [remembered, setRemembered] = useState<Remembered[]>([]);
  const phaseRef = useRef<Phase>('idle');
  const abort = useRef<AbortController | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const talk = useRef<{ cancel: () => void } | null>(null);
  const prefs = useRef(preferences); prefs.current = preferences;
  const focusRef = useRef(focus); focusRef.current = focus;
  const retryVia = useRef<'text' | 'voice'>('text');
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const stopSound = () => { rec.current?.abort(); rec.current = null; talk.current?.cancel(); talk.current = null; cancelSpeech(); };
  const stopAll = () => { abort.current?.abort(); abort.current = null; stopSound(); setInterim(''); setPhase('idle'); };
  useEffect(() => () => { abort.current?.abort(); rec.current?.abort(); talk.current?.cancel(); cancelSpeech(); }, []);

  const speakReply = (text: string) => {
    const p = prefs.current;
    if (!p) return;
    talk.current?.cancel();
    const handle = speak(text, {
      voice: p.voice, volume: p.volume,
      onStart: () => setPhase('speaking'),
      onEnd: () => { if (phaseRef.current === 'speaking') setPhase('idle'); },
      onError: () => { setNotice('Não foi possível reproduzir a voz neste navegador.'); setPhase('idle'); },
    });
    if (!handle) { setNotice('Este navegador não oferece síntese de voz.'); setPhase('idle'); return; }
    talk.current = handle; setPhase('speaking');
  };

  const send = async (raw: string, via: 'text' | 'voice', isRetry = false) => {
    const text = raw.trim();
    if (!text || phaseRef.current === 'thinking') return;
    stopSound(); setPhase('thinking'); setError(null); setCanRetry(false); setNotice(null); setInterim('');
    retryVia.current = via;
    if (!isRetry) {
      const e = await mutate(s => appendMessages(s, [{ role: 'user', text, via }]));
      if (e) { setError(e); setPhase('idle'); return; }
    }
    const access = await getAccessCode();
    if (!access) { setError('Informe o código de acesso em Configurações para conversar.'); setPhase('idle'); return; }
    const controller = new AbortController();
    abort.current = controller;
    try {
      const s = getData();
      if (!s) throw new ChatError('Seus dados ainda não foram abertos.', 'NO_DATA');
      const res = await postChat({ messages: buildMessages(s), context: buildContext(s, focusRef.current) }, access, controller.signal);
      if (controller.signal.aborted) return;
      const saveErr = await mutate(st => appendMessages(st, [{ role: 'assistant', text: res.text, via: 'text' }]));
      if (saveErr) setError(saveErr);
      if (res.proposals.length) setPending(list => [...list, ...res.proposals.map(draft => ({ id: newId(), draft }))]);
      for (const fact of res.remembered) {
        const id = newId();
        const e = await mutate(st => addMemory(st, fact, { id }));
        if (!e && getData()?.memories.some(m => m.id === id)) setRemembered(list => [...list, { id, text: fact }]);
      }
      if (via === 'voice') speakReply(res.text); else setPhase('idle');
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof ChatError ? e.message : 'Algo deu errado. Tente de novo.');
      setCanRetry(true); setPhase('idle');
    } finally { if (abort.current === controller) abort.current = null; }
  };

  const retry = () => {
    const last = [...(getData()?.messages ?? [])].reverse().find(m => m.role === 'user');
    if (last) void send(last.text, retryVia.current, true);
  };

  const listen = () => {
    if (!recognitionSupported()) { setNotice('Este navegador não reconhece voz (o Firefox não oferece esse recurso). Use o campo de texto.'); return; }
    stopSound(); setError(null); setNotice(null); setInterim('');
    const r = createRecognizer({
      onInterim: setInterim,
      onFinal: t => { void send(t, 'voice'); },
      onEnd: () => { rec.current = null; if (phaseRef.current === 'listening') setPhase('idle'); setInterim(''); },
      onError: code => { if (code !== 'aborted') setError(MIC_ERRORS[code] ?? `O reconhecimento de voz falhou (${code}).`); setPhase('idle'); },
    });
    if (!r) return;
    rec.current = r; setPhase('listening');
    try { r.start(); } catch { rec.current = null; setPhase('idle'); setError('Não foi possível iniciar o microfone.'); }
  };

  /** Toque na esfera: ouvir, concluir a fala, cancelar o pensamento ou interromper a resposta e ouvir de novo. */
  const press = () => {
    switch (phaseRef.current) {
      case 'listening': rec.current?.stop(); break;
      case 'thinking': stopAll(); break;
      case 'speaking': stopSound(); setPhase('idle'); listen(); break;
      default: listen();
    }
  };

  const accept = async (p: Pending) => {
    const d = p.draft; const id = newId();
    const e = await mutate(s => d.kind === 'idea' ? addIdea(s, { title: d.title, body: d.body }, { id })
      : d.kind === 'project' ? addProject(s, { title: d.title, goal: d.body }, { id })
      : d.kind === 'note' ? addNote(s, { title: d.title, body: d.body }, { id })
      : addDecision(s, d.projectId ?? '', d.body));
    if (e) { setNotice(e); return; }
    setPending(list => list.filter(x => x.id !== p.id)); setNotice(SAVED[d.kind]);
  };
  const dismiss = (id: string) => setPending(list => list.filter(x => x.id !== id));
  const undo = async (r: Remembered) => { await mutate(s => removeMemory(s, r.id)); setRemembered(list => list.filter(x => x.id !== r.id)); };

  return { phase, interim, error, canRetry, notice, pending, remembered, send, retry, press, stopAll, speakReply, accept, dismiss, undo, clearNotice: () => setNotice(null),
    support: { recognition: recognitionSupported(), synthesis: synthesisSupported() } };
}
