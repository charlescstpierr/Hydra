import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';

export type ProviderId = 'xai' | 'anthropic' | 'openai' | 'google' | 'local';

export interface ModelInfo {
  /** Stable identifier used by the UI and stored in the database: `provider:modelId`. */
  id: string;
  provider: ProviderId;
  modelId: string;
  label: string;
  /** Short hint shown in the picker so the user knows what the model is good at. */
  hint: string;
  available: boolean;
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  xai: 'xAI (Grok)',
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (GPT)',
  google: 'Google (Gemini)',
  local: 'Local / OpenAI-compatible',
};

const CATALOG: Omit<ModelInfo, 'available' | 'id'>[] = [
  { provider: 'xai', modelId: 'grok-4.6', label: 'Grok 4.6', hint: 'Rapide, ton direct, accès X' },
  { provider: 'xai', modelId: 'grok-4.5', label: 'Grok 4.5', hint: 'Généraliste xAI' },
  { provider: 'anthropic', modelId: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', hint: 'Rédaction et code, équilibré' },
  { provider: 'anthropic', modelId: 'claude-opus-4-8', label: 'Claude Opus 4.8', hint: 'Raisonnement long, le plus fort' },
  { provider: 'anthropic', modelId: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', hint: 'Rapide et économique' },
  { provider: 'openai', modelId: 'gpt-5.2', label: 'GPT-5.2', hint: 'Généraliste OpenAI' },
  { provider: 'openai', modelId: 'gpt-5.4-mini', label: 'GPT-5.4 mini', hint: 'Rapide et économique' },
  { provider: 'google', modelId: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', hint: 'Contexte très long, multimodal' },
  { provider: 'google', modelId: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Rapide et économique' },
];

function localModelIds(): string[] {
  return (process.env.LOCAL_MODELS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function providerAvailable(provider: ProviderId): boolean {
  switch (provider) {
    case 'xai':
      return Boolean(process.env.XAI_API_KEY);
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case 'openai':
      return Boolean(process.env.OPENAI_API_KEY);
    case 'google':
      return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    case 'local':
      return Boolean(process.env.LOCAL_BASE_URL);
  }
}

export function listModels(): ModelInfo[] {
  const catalog: ModelInfo[] = CATALOG.map((m) => ({
    ...m,
    id: `${m.provider}:${m.modelId}`,
    available: providerAvailable(m.provider),
  }));

  const local: ModelInfo[] = localModelIds().map((modelId) => ({
    id: `local:${modelId}`,
    provider: 'local' as const,
    modelId,
    label: modelId,
    hint: 'Modèle local (OpenAI-compatible)',
    available: providerAvailable('local'),
  }));

  return [...catalog, ...local];
}

export function parseModelId(id: string): { provider: ProviderId; modelId: string } {
  const idx = id.indexOf(':');
  if (idx === -1) throw new Error(`Identifiant de modèle invalide: ${id}`);
  const provider = id.slice(0, idx) as ProviderId;
  const modelId = id.slice(idx + 1);
  if (!(provider in PROVIDER_LABELS)) throw new Error(`Fournisseur inconnu: ${provider}`);
  return { provider, modelId };
}

export function resolveModel(id: string): LanguageModel {
  const { provider, modelId } = parseModelId(id);
  if (!providerAvailable(provider)) {
    throw new Error(
      `Le fournisseur ${PROVIDER_LABELS[provider]} n'est pas configuré. Ajoute sa clé API dans .env.local.`,
    );
  }
  switch (provider) {
    case 'xai':
      return createXai({ apiKey: process.env.XAI_API_KEY })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelId);
    case 'openai':
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(modelId);
    case 'local':
      return createOpenAI({
        apiKey: process.env.LOCAL_API_KEY ?? 'local',
        baseURL: process.env.LOCAL_BASE_URL,
      })(modelId);
  }
}

export function modelLabel(id: string): string {
  const known = listModels().find((m) => m.id === id);
  if (known) return known.label;
  try {
    return parseModelId(id).modelId;
  } catch {
    return id;
  }
}

/** Cheap model used for background work (memory extraction, summaries, titles). */
export function utilityModelId(): string | null {
  const configured = process.env.UTILITY_MODEL;
  if (configured) return configured;
  const preferred = [
    'anthropic:claude-haiku-4-5',
    'openai:gpt-5.4-mini',
    'google:gemini-2.5-flash',
    'xai:grok-4.5',
  ];
  return preferred.find((id) => providerAvailable(parseModelId(id).provider)) ?? null;
}

export function defaultModelId(): string | null {
  const configured = process.env.DEFAULT_MODEL;
  if (configured) return configured;
  return listModels().find((m) => m.available)?.id ?? null;
}
