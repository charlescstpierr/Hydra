'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment, Persona } from '@/lib/db';
import type { ModelInfo } from '@/lib/models';
import type { VoiceInfo } from '@/lib/voice';
import { IconClose, IconPlus, IconTrash, IconVoice } from '@/components/icons';
import { MASCOTS, Mascot } from '@/components/mascot';

interface Draft {
  id?: string;
  name: string;
  avatar: string;
  tagline: string;
  instructions: string;
  greeting: string;
  tone: string[];
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
  greeting: '',
  tone: [],
  preferredModel: '',
  voice: '',
  voiceSpeed: 1,
  voiceLanguage: '',
};

const TONES = [
  'Chaleureux',
  'Direct',
  'Drôle',
  'Sarcastique',
  'Formel',
  'Familier',
  'Concis',
  'Détaillé',
  'Encourageant',
  'Provocateur',
  'Poétique',
  'Pragmatique',
];

const TEMPLATES: { label: string; draft: Partial<Draft> }[] = [
  {
    label: 'Compagnon',
    draft: {
      tagline: 'Toujours là pour jaser',
      instructions:
        "Tu es un compagnon proche. Tu tutoies, tu poses des questions, tu te souviens des détails personnels et tu réponds court, comme dans un texto.",
      greeting: 'Hey, quoi de neuf ?',
      tone: ['Chaleureux', 'Familier', 'Concis'],
    },
  },
  {
    label: 'Expert',
    draft: {
      tagline: 'Réponses précises, zéro blabla',
      instructions:
        'Tu es un expert technique. Tu vas droit au but, tu structures, tu donnes des exemples concrets et tu signales les pièges.',
      greeting: 'Dis-moi sur quoi tu travailles.',
      tone: ['Direct', 'Détaillé', 'Pragmatique'],
    },
  },
  {
    label: 'Coach',
    draft: {
      tagline: 'Te pousse à passer à l’action',
      instructions:
        "Tu es un coach exigeant mais bienveillant. Tu challenges les excuses, tu proposes des prochaines étapes concrètes et tu fais un suivi.",
      greeting: 'On attaque quoi aujourd’hui ?',
      tone: ['Encourageant', 'Direct'],
    },
  },
  {
    label: 'Conteur',
    draft: {
      tagline: 'Invente des histoires sur mesure',
      instructions:
        'Tu es un conteur. Tu écris des scènes vivantes, tu tiens la continuité du récit et tu laisses toujours une porte ouverte pour la suite.',
      greeting: 'Dans quel univers on plonge ?',
      tone: ['Poétique', 'Détaillé'],
    },
  },
];

function draftFrom(persona: Persona): Draft {
  return {
    id: persona.id,
    name: persona.name,
    avatar: persona.avatar ?? 'persona-default',
    tagline: persona.tagline,
    instructions: persona.instructions,
    greeting: persona.greeting ?? '',
    tone: (persona.tone ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    preferredModel: persona.preferred_model ?? '',
    voice: persona.voice ?? '',
    voiceSpeed: persona.voice_speed ?? 1,
    voiceLanguage: persona.voice_language ?? '',
  };
}

export function BotStudio({
  personas,
  models,
  voices,
  activeId,
  onClose,
  onSelect,
  onChange,
  onStartChat,
}: {
  personas: Persona[];
  models: ModelInfo[];
  voices: VoiceInfo[];
  activeId: string | null;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onChange: () => Promise<void> | void;
  onStartChat: (personaId: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const mine = useMemo(() => personas.filter((p) => p.is_preset === 0), [personas]);
  const presets = useMemo(() => personas.filter((p) => p.is_preset === 1), [personas]);

  async function save() {
    if (!draft?.name.trim() || !draft.instructions.trim() || saving) return;
    setSaving(true);
    const payload = {
      name: draft.name,
      avatar: draft.avatar,
      tagline: draft.tagline,
      instructions: draft.instructions,
      greeting: draft.greeting,
      tone: draft.tone.join(', '),
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
    setSaving(false);
    setDraft(null);
    await onChange();
  }

  async function uploadAvatar(file: File) {
    if (!draft) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    if (!res.ok) return;
    const { attachment } = (await res.json()) as { attachment: Attachment };
    setDraft({ ...draft, avatar: `upload:${attachment.id}` });
  }

  async function remove(id: string) {
    await fetch(`/api/personas/${id}`, { method: 'DELETE' });
    if (activeId === id) onSelect(null);
    await onChange();
  }

  const card = (persona: Persona) => (
    <div
      key={persona.id}
      className={`card flex flex-col gap-3 p-4 ${
        activeId === persona.id ? 'border-[var(--accent)]' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <Mascot avatar={persona.avatar} size={46} alt={persona.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{persona.name}</div>
          <div className="line-clamp-2 text-xs text-[var(--muted)]">{persona.tagline}</div>
          {persona.voice && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--muted)]">
              <IconVoice className="h-3 w-3" />
              {persona.voice}
            </div>
          )}
        </div>
      </div>

      {persona.tone && (
        <div className="flex flex-wrap gap-1">
          {persona.tone
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
              >
                {t}
              </span>
            ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 text-xs">
        <button onClick={() => void onStartChat(persona.id)} className="btn btn-primary flex-1">
          Discuter
        </button>
        <button onClick={() => setDraft(draftFrom(persona))} className="btn btn-outline">
          Modifier
        </button>
        {persona.is_preset === 0 && (
          <button
            onClick={() => void remove(persona.id)}
            title="Supprimer"
            className="btn btn-icon text-[var(--muted)] hover:text-[var(--danger)]"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="bot-studio-title">
      <div className="glass flex h-full max-h-[900px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border)]">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 id="bot-studio-title" className="text-base font-semibold">
              {draft ? (draft.id ? 'Modifier le bot' : 'Créer un bot') : 'Mes bots'}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {draft
                ? 'Identité, personnalité, voix et modèle préféré.'
                : 'Crée tes propres bots et discute avec eux.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!draft && (
              <button onClick={() => setDraft({ ...EMPTY })} className="btn btn-primary">
                <IconPlus className="h-3.5 w-3.5" /> Créer un bot
              </button>
            )}
            <button onClick={onClose} className="btn btn-icon text-[var(--muted)]" aria-label="Fermer Mes bots">
              <IconClose />
            </button>
          </div>
        </header>

        {draft ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid gap-5 md:grid-cols-[260px_1fr]">
              <section className="space-y-3">
                <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <Mascot avatar={draft.avatar} size={84} alt={draft.name || 'Bot'} />
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAvatar(file);
                      event.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="btn btn-outline w-full"
                  >
                    Importer une image
                  </button>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                    Mascottes
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
                        <Mascot avatar={mascot.id} size={34} alt={mascot.label} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3 text-xs">
                {!draft.id && (
                  <div>
                    <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                      Partir d’un modèle
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.map((template) => (
                        <button
                          key={template.label}
                          onClick={() => setDraft({ ...draft, ...template.draft })}
                          className="btn btn-outline"
                        >
                          {template.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <input
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Nom du bot"
                  className="field w-full"
                />
                <input
                  value={draft.tagline}
                  onChange={(event) => setDraft({ ...draft, tagline: event.target.value })}
                  placeholder="Description courte (ex. coach sportif sans pitié)"
                  className="field w-full"
                />
                <textarea
                  value={draft.instructions}
                  onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
                  rows={8}
                  placeholder="Personnalité : qui il est, comment il parle, ce qu’il fait et ne fait jamais…"
                  className="field w-full resize-none"
                />
                <input
                  value={draft.greeting}
                  onChange={(event) => setDraft({ ...draft, greeting: event.target.value })}
                  placeholder="Phrase d’accueil (premier message du bot)"
                  className="field w-full"
                />

                <div>
                  <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--muted)]">
                    Ton
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TONES.map((tone) => {
                      const on = draft.tone.includes(tone);
                      return (
                        <button
                          key={tone}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              tone: on
                                ? draft.tone.filter((t) => t !== tone)
                                : [...draft.tone, tone],
                            })
                          }
                          className={`rounded-full px-3 py-1 text-[11px] transition ${
                            on
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-[var(--surface-3)] text-[var(--muted)] hover:text-[var(--foreground)]'
                          }`}
                        >
                          {tone}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                      <span className="text-[var(--muted)]">
                        Vitesse {draft.voiceSpeed.toFixed(2)}×
                      </span>
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
                    disabled={!draft.name.trim() || !draft.instructions.trim() || saving}
                    className="btn btn-primary flex-1 disabled:opacity-40"
                  >
                    {draft.id ? 'Enregistrer' : 'Créer le bot'}
                  </button>
                  <button onClick={() => setDraft(null)} className="btn btn-outline">
                    Annuler
                  </button>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <section>
              <h3 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                Mes bots
              </h3>
              {mine.length === 0 ? (
                <button
                  onClick={() => setDraft({ ...EMPTY })}
                  className="card flex w-full items-center gap-3 p-4 text-left hover:border-[var(--accent)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-3)]">
                    <IconPlus />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">Créer ton premier bot</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Nom, avatar, personnalité, voix, modèle préféré.
                    </span>
                  </span>
                </button>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map(card)}</div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                Bots prédéfinis
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{presets.map(card)}</div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
