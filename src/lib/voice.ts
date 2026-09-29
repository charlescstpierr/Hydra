import { createOpenAI } from '@ai-sdk/openai';
import { generateSpeech, transcribe } from 'ai';
import { providerAvailable } from './models';

export type VoiceProvider = 'xai' | 'openai';

export interface VoiceInfo {
  id: string;
  name: string;
  description: string;
  custom: boolean;
}

/** Built-in xAI voices; the API also exposes cloned voices through /v1/tts/voices. */
const XAI_VOICES: VoiceInfo[] = [
  { id: 'eve', name: 'Eve', description: 'Féminine, énergique, enjouée (défaut)', custom: false },
  { id: 'ara', name: 'Ara', description: 'Féminine, chaleureuse, conversationnelle', custom: false },
  { id: 'rex', name: 'Rex', description: 'Masculine, assurée, professionnelle', custom: false },
  { id: 'sal', name: 'Sal', description: 'Neutre, douce, polyvalente', custom: false },
  { id: 'leo', name: 'Leo', description: 'Masculine, autoritaire, instructive', custom: false },
];

const OPENAI_VOICES: VoiceInfo[] = [
  { id: 'alloy', name: 'Alloy', description: 'Neutre, équilibrée', custom: false },
  { id: 'ash', name: 'Ash', description: 'Grave, posée', custom: false },
  { id: 'ballad', name: 'Ballad', description: 'Douce, narrative', custom: false },
  { id: 'coral', name: 'Coral', description: 'Chaleureuse, expressive', custom: false },
  { id: 'echo', name: 'Echo', description: 'Claire, professionnelle', custom: false },
  { id: 'sage', name: 'Sage', description: 'Calme, pédagogue', custom: false },
  { id: 'shimmer', name: 'Shimmer', description: 'Lumineuse, énergique', custom: false },
  { id: 'verse', name: 'Verse', description: 'Vivante, théâtrale', custom: false },
];

export const XAI_API = 'https://api.x.ai/v1';

/** xAI is preferred because it exposes speed, languages, speech tags and voice cloning. */
export function voiceProvider(): VoiceProvider | null {
  if (providerAvailable('xai')) return 'xai';
  if (providerAvailable('openai')) return 'openai';
  return null;
}

export const voiceAvailable = () => voiceProvider() !== null;
export const voiceCloningAvailable = () => voiceProvider() === 'xai';

export const DEFAULT_VOICE = process.env.SPEECH_VOICE ?? null;
export const OPENAI_SPEECH_MODEL = process.env.OPENAI_SPEECH_MODEL ?? 'gpt-4o-mini-tts';
export const OPENAI_TRANSCRIPTION_MODEL =
  process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-transcribe';

function openai() {
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function listVoices(): Promise<VoiceInfo[]> {
  const provider = voiceProvider();
  if (provider === 'openai') return OPENAI_VOICES;
  if (provider !== 'xai') return [];

  try {
    const response = await fetch(`${XAI_API}/tts/voices`, {
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    });
    if (!response.ok) return XAI_VOICES;
    const payload = (await response.json()) as {
      voices?: { voice_id: string; name?: string; description?: string; custom?: boolean }[];
    };
    const voices = (payload.voices ?? []).map((voice) => ({
      id: voice.voice_id,
      name: voice.name ?? voice.voice_id,
      description: voice.description ?? '',
      custom: voice.custom ?? !XAI_VOICES.some((v) => v.id === voice.voice_id),
    }));
    return voices.length > 0 ? voices : XAI_VOICES;
  } catch {
    return XAI_VOICES;
  }
}

export interface SpeechOptions {
  text: string;
  voice?: string | null;
  /** 0.7 – 1.5 on xAI. Ignored by the OpenAI fallback. */
  speed?: number | null;
  /** BCP-47 code or `auto`. */
  language?: string | null;
}

export async function synthesize(
  options: SpeechOptions,
): Promise<{ data: Uint8Array; mediaType: string }> {
  const provider = voiceProvider();
  if (!provider) throw new Error('Aucun fournisseur vocal configuré');

  const text = options.text.slice(0, 15000);

  if (provider === 'xai') {
    const response = await fetch(`${XAI_API}/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: options.voice ?? DEFAULT_VOICE ?? 'eve',
        language: options.language ?? 'auto',
        speed: options.speed ?? 1,
        text_normalization: true,
      }),
    });
    if (!response.ok) {
      throw new Error(`Synthèse vocale xAI : ${response.status} ${await response.text()}`);
    }
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      mediaType: response.headers.get('content-type') ?? 'audio/mpeg',
    };
  }

  const { audio } = await generateSpeech({
    model: openai().speech(OPENAI_SPEECH_MODEL),
    text,
    voice: options.voice ?? DEFAULT_VOICE ?? 'alloy',
    speed: options.speed ?? undefined,
    language: options.language ?? undefined,
  });
  return { data: audio.uint8Array, mediaType: audio.mediaType ?? 'audio/mpeg' };
}

export async function speechToText(input: {
  data: Uint8Array;
  filename: string;
  mediaType: string;
  language?: string | null;
}): Promise<string> {
  const provider = voiceProvider();
  if (!provider) throw new Error('Aucun fournisseur vocal configuré');

  if (provider === 'xai') {
    const form = new FormData();
    if (input.language) {
      form.set('language', input.language);
      form.set('format', 'true');
    }
    // The file field must come last for the xAI STT endpoint.
    form.set('file', new Blob([new Uint8Array(input.data)], { type: input.mediaType }), input.filename);

    const response = await fetch(`${XAI_API}/stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(`Transcription xAI : ${response.status} ${await response.text()}`);
    }
    const payload = (await response.json()) as { text: string };
    return payload.text;
  }

  const { text } = await transcribe({
    model: openai().transcription(OPENAI_TRANSCRIPTION_MODEL),
    audio: input.data,
  });
  return text;
}

/** Clones a voice from a reference clip (xAI only) and returns the new voice id. */
export async function cloneVoice(input: {
  name: string;
  language: string;
  data: Uint8Array;
  filename: string;
  mediaType: string;
}): Promise<string> {
  if (voiceProvider() !== 'xai') {
    throw new Error('Le clonage de voix nécessite une clé XAI_API_KEY');
  }
  const form = new FormData();
  form.set('name', input.name);
  form.set('language', input.language);
  form.set('file', new Blob([new Uint8Array(input.data)], { type: input.mediaType }), input.filename);

  const response = await fetch(`${XAI_API}/custom-voices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Clonage de voix : ${response.status} ${await response.text()}`);
  }
  const payload = (await response.json()) as { voice_id: string };
  return payload.voice_id;
}
