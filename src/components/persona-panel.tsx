'use client';

import { useState } from 'react';
import type { Persona } from '@/lib/db';
import type { ModelInfo } from '@/lib/models';
import type { VoiceInfo } from '@/lib/voice';
import { IconClose, IconPersona, IconVoice } from '@/components/icons';
import { MASCOTS, Mascot } from '@/components/mascot';

interface Draft {
  id?: string;
  name: string;
  avatar: string;
  tagline: string;
  instructions: string;
  preferredModel: string;
  voice: string;
  voiceSpeed: number;
  voiceLanguage: string;
}

const EMPTY: Draft = {
  name: '',
  avatar: 'persona-default',
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
      avatar: draft.avatar,
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
    <aside className="glass flex w-[320px] shrink-0 flex-col border-l border-[var(--border)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-semibold"><IconPersona />Personas</span>
        <button onClick={onClose} className="btn btn-icon text-[var(--muted)]">
          <IconClose />
        </button>
      </div>

      {draft ? (
        <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Nom"
            className="field w-full"
          />
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--muted)]">
              Mascotte
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {MASCOTS.map((mascot) => (
                <button
                  key={mascot.id}
                  onClick={() => setDraft({ ...draft, avatar: mascot.id })}
                  title={mascot.label}
                  className={`rounded-full p-0.5 transition ${
                    draft.avatar === mascot.id
                      ? 'ring-2 ring-[var(--accent)]'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Mascot avatar={mascot.id} size={36} alt={mascot.label} />
                </button>
              ))}
            </div>
          </div>
          <input
            value={draft.tagline}
            onChange={(event) => setDraft({ ...draft, tagline: event.target.value })}
            placeholder="Accroche"
            className="field w-full"
          />
          <textarea
            value={draft.instructions}
            onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
            rows={10}
            placeholder="Instructions : ton, style, règles…"
            className="field w-full resize-none"
          />
          <select
            value={draft.preferredModel}
            onChange={(event) => setDraft({ ...draft, preferredModel: event.target.value })}
            className="field w-full"
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
                className="field w-full"
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
                className="field w-full"
              />
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void save()}
              className="btn btn-primary flex-1"
            >
              Enregistrer
            </button>
            <button
              onClick={() => setDraft(null)}
              className="btn btn-outline"
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
                className={`card p-2.5 text-xs ${
                  activeId === persona.id
                    ? 'border-[var(--accent)] bg-[var(--surface-2)]'
                    : 'border-[var(--border)] bg-[var(--surface-2)]'
                }`}
              >
                <button onClick={() => onSelect(persona.id)} className="flex w-full gap-2.5 text-left">
                  <Mascot avatar={persona.avatar} size={38} alt={persona.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{persona.name}</span>
                    <span className="block text-[var(--muted)]">{persona.tagline}</span>
                    {persona.voice && (
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--muted)]">
                        <IconVoice className="h-3 w-3" />
                        {persona.voice}
                      </span>
                    )}
                  </span>
                </button>
                <div className="mt-2 flex gap-2 text-[11px] text-[var(--muted)]">
                  <button
                    onClick={() =>
                      setDraft({
                        id: persona.id,
                        name: persona.name,
                        avatar: persona.avatar ?? 'persona-default',
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
                    <button onClick={() => void remove(persona.id)} className="hover:text-[var(--danger)]">
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
              className="btn btn-primary w-full"
            >
              Nouveau persona
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
