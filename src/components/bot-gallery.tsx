'use client';

import type { Persona } from '@/lib/db';
import { IconChat, IconPlus, IconVoice } from '@/components/icons';
import { MascotFigure, mascotPalette } from '@/components/mascot';

export function BotGallery({
  personas,
  onChat,
  onVoice,
  onCreate,
  onOpenComputer,
}: {
  personas: Persona[];
  onChat: (id: string) => void;
  onVoice: (id: string) => void;
  onCreate: () => void;
  onOpenComputer: (id: string) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {personas.map((persona) => {
        const palette = mascotPalette(persona.avatar);
        return (
          <article
            key={persona.id}
            role="button"
            tabIndex={0}
            aria-label={`Ouvrir l’ordinateur de ${persona.name}`}
            onClick={() => onOpenComputer(persona.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenComputer(persona.id);
              }
            }}
            className="fade-in group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-3xl border border-white/10 shadow-lg transition hover:-translate-y-0.5 hover:border-white/25"
            style={{
              background: `radial-gradient(circle at 50% 30%, ${palette.secondary}, ${palette.primary} 70%)`,
            }}
          >
            <span className="absolute -left-8 top-5 h-24 w-24 rounded-full bg-white/10" />
            <span className="absolute -right-8 top-20 h-32 w-32 rounded-full bg-white/10" />
            <span className="absolute bottom-20 left-8 h-16 w-16 rounded-full bg-white/10" />
            <MascotFigure
              avatar={persona.avatar}
              size={96}
              alt={persona.name}
              className="absolute left-1/2 top-[22%] -translate-x-1/2"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-3 pb-3 pt-16 text-left">
              <div className="text-sm font-semibold text-white">{persona.name}</div>
              <div className="mt-0.5 line-clamp-2 text-[11px] text-white/70">{persona.tagline}</div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChat(persona.id);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-white/25"
                >
                  <IconChat className="h-3.5 w-3.5" /> Discuter
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onVoice(persona.id);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-white/25"
                >
                  <IconVoice className="h-3.5 w-3.5" /> Parler
                </button>
              </div>
            </div>
          </article>
        );
      })}
      <button
        type="button"
        onClick={onCreate}
        className="fade-in flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] text-center text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-current">
          <IconPlus />
        </span>
        <span>Créer un compagnon</span>
      </button>
    </div>
  );
}
