'use client';

import { useState } from 'react';
import type { Persona } from '@/lib/db';
import type { ModelInfo } from '@/lib/models';
import type { VoiceInfo } from '@/lib/voice';

interface Draft {
  id?: string;
  name: string;
  emoji: string;
  tagline: string;
  instructions: string;
  preferredModel: string;
  voice: string;
  voiceSpeed: number;
  voiceLanguage: string;
}

const EMPTY: Draft = {
  name: '',
  emoji: '🤖',
  tagline: '',
  instructions: '',
  preferredModel: '',
  voice: '',
  voiceSpeed: 1,
  voiceLanguage: '',
};

export function PersonaPanel({
  personas,
  models,
  voices,
  activeId,
  onClose,
  onSelect,
  onChange,
}: {
  personas: Persona[];
  models: ModelInfo[];
  voices: VoiceInfo[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onChange: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);

  async function save() {
    if (!draft?.name.trim() || !draft.instructions.trim()) return;
    const payload = {
      name: draft.name,
      emoji: draft.emoji,
      tagline: draft.tagline,
      instructions: draft.instructions,
      preferredModel: draft.preferredModel || null,
      voice: draft.voice || null,
      voiceSpeed: draft.voiceSpeed,
      voiceLanguage: draft.voiceLanguage || null,
    };
    await fetch(draft.id ? `/api/personas/${draft.id}` : '/api/personas', {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setDraft(null);
    await onChange();
  }

  async function remove(id: string) {
    await fetch(`/api/personas/${id}`, { method: 'DELETE' });
    if (activeId === id) onSelect(null);
    await onChange();
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold">🎭 Personas</span>
        <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
          ✕
        </button>
      </div>

      {draft ? (
        <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
          <div className="flex gap-2">
            <input
              value={draft.emoji}
              onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
              className="w-14 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-center"
            />
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Nom"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
            />
          </div>
          <input
            value={draft.tagline}
            onChange={(event) => setDraft({ ...draft, tagline: event.target.value })}
            placeholder="Accroche"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
          />
          <textarea
            value={draft.instructions}
            onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
            rows={10}
            placeholder="Instructions : ton, style, règles…"
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2"
          />
          <select
            value={draft.preferredModel}
            onChange={(event) => setDraft({ ...draft, preferredModel: event.target.value })}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
          >
            <option value="">Modèle préféré : aucun</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          {voices.length > 0 && (
            <>
              <select
                value={draft.voice}
                onChange={(event) => setDraft({ ...draft, voice: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
              >
                <option value="">Voix : par défaut</option>
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                    {voice.custom ? ' (custom)' : ''}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2">
                <span className="text-[var(--muted)]">Vitesse {draft.voiceSpeed.toFixed(2)}×</span>
                <input
                  type="range"
                  min={0.7}
                  max={1.5}
                  step={0.05}
                  value={draft.voiceSpeed}
                  onChange={(event) =>
                    setDraft({ ...draft, voiceSpeed: Number(event.target.value) })
                  }
                  className="flex-1"
                />
              </label>
              <input
                value={draft.voiceLanguage}
                onChange={(event) => setDraft({ ...draft, voiceLanguage: event.target.value })}
                placeholder="Langue de la voix (fr, en, auto…)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
              />
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void save()}
              className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-white"
            >
              Enregistrer
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {personas.map((persona) => (
              <div
                key={persona.id}
                className={`rounded-lg border p-2 text-xs ${
                  activeId === persona.id
                    ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)]'
                }`}
              >
                <button onClick={() => onSelect(persona.id)} className="w-full text-left">
                  <div className="font-medium">
                    {persona.emoji} {persona.name}
                  </div>
                  <div className="text-[var(--muted)]">{persona.tagline}</div>
                  {persona.voice && (
                    <div className="text-[11px] text-[var(--muted)]">🔊 {persona.voice}</div>
                  )}
                </button>
                <div className="mt-2 flex gap-2 text-[11px] text-[var(--muted)]">
                  <button
                    onClick={() =>
                      setDraft({
                        id: persona.id,
                        name: persona.name,
                        emoji: persona.emoji,
                        tagline: persona.tagline,
                        instructions: persona.instructions,
                        preferredModel: persona.preferred_model ?? '',
                        voice: persona.voice ?? '',
                        voiceSpeed: persona.voice_speed ?? 1,
                        voiceLanguage: persona.voice_language ?? '',
                      })
                    }
                    className="hover:text-[var(--foreground)]"
                  >
                    Modifier
                  </button>
                  {persona.is_preset === 0 && (
                    <button onClick={() => void remove(persona.id)} className="hover:text-red-400">
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--border)] p-3">
            <button
              onClick={() => setDraft({ ...EMPTY })}
              className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white"
            >
              + Nouveau persona
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
