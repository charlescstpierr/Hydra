'use client';

import { useRef, useState } from 'react';
import type { VoiceInfo } from '@/lib/voice';

export interface VoiceSettings {
  voice: string;
  speed: number;
  language: string;
  autoplay: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voice: '',
  speed: 1,
  language: '',
  autoplay: false,
};

export function VoicePanel({
  voices,
  provider,
  cloning,
  settings,
  onSettings,
  onVoicesChange,
  onPreview,
  onClose,
}: {
  voices: VoiceInfo[];
  provider: string | null;
  cloning: boolean;
  settings: VoiceSettings;
  onSettings: (settings: VoiceSettings) => void;
  onVoicesChange: () => Promise<void> | void;
  onPreview: (text: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [cloneName, setCloneName] = useState('');
  const [cloneLanguage, setCloneLanguage] = useState('fr');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function clone() {
    const file = fileRef.current?.files?.[0];
    if (!file || !cloneName.trim()) {
      setMessage('Choisis un extrait audio et donne un nom à la voix.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set('name', cloneName.trim());
    form.set('language', cloneLanguage);
    form.set('file', file);
    const res = await fetch('/api/voices', { method: 'POST', body: form });
    const payload = (await res.json()) as { error?: string; voiceId?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage(payload.error ?? 'Clonage impossible');
      return;
    }
    setMessage(`Voix créée : ${payload.voiceId}`);
    setCloneName('');
    if (fileRef.current) fileRef.current.value = '';
    await onVoicesChange();
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold">🔊 Voix</span>
        <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-xs">
        <p className="text-[var(--muted)]">
          Fournisseur : {provider ?? 'aucun'}
          {provider === 'xai' && ' · balises expressives [pause] [laugh] [whisper] supportées'}
        </p>

        <label className="block space-y-1">
          <span className="text-[var(--muted)]">Voix par défaut</span>
          <select
            value={settings.voice}
            onChange={(event) => onSettings({ ...settings, voice: event.target.value })}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
          >
            <option value="">Voix du persona</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
                {voice.custom ? ' (custom)' : ''}
              </option>
            ))}
          </select>
        </label>

        {settings.voice && (
          <p className="text-[var(--muted)]">
            {voices.find((v) => v.id === settings.voice)?.description}
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-[var(--muted)]">Vitesse : {settings.speed.toFixed(2)}×</span>
          <input
            type="range"
            min={0.7}
            max={1.5}
            step={0.05}
            value={settings.speed}
            onChange={(event) => onSettings({ ...settings, speed: Number(event.target.value) })}
            className="w-full"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[var(--muted)]">Langue</span>
          <input
            value={settings.language}
            onChange={(event) => onSettings({ ...settings, language: event.target.value })}
            placeholder="auto, fr, en, es…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.autoplay}
            onChange={(event) => onSettings({ ...settings, autoplay: event.target.checked })}
          />
          Lire automatiquement chaque réponse
        </label>

        <button
          onClick={() =>
            void onPreview(
              "Salut, c'est Hydra. [pause] Voici un aperçu de cette voix, avec le réglage de vitesse actuel.",
            )
          }
          className="w-full rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--surface-2)]"
        >
          ▶ Écouter un aperçu
        </button>

        {cloning && (
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <div className="font-medium">Cloner une voix</div>
            <p className="text-[var(--muted)]">
              Extrait audio de référence de 120 secondes maximum, dont tu as le droit d’utiliser la
              voix.
            </p>
            <input
              value={cloneName}
              onChange={(event) => setCloneName(event.target.value)}
              placeholder="Nom de la voix"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
            />
            <input
              value={cloneLanguage}
              onChange={(event) => setCloneLanguage(event.target.value)}
              placeholder="Langue (fr)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
            />
            <input ref={fileRef} type="file" accept="audio/*" className="w-full text-[11px]" />
            <button
              onClick={() => void clone()}
              disabled={busy}
              className="w-full rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Clonage…' : 'Créer la voix'}
            </button>
          </div>
        )}

        {message && <p className="text-[var(--muted)]">{message}</p>}
      </div>
    </aside>
  );
}
