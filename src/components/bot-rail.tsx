'use client';

import { useEffect, useRef } from 'react';
import type { Persona } from '@/lib/db';
import { Mascot, mascotPalette } from '@/components/mascot';
import { IconPlus } from '@/components/icons';

export function BotRail({
  personas,
  activePersonaId,
  selectedBotId,
  busyPersonaIds,
  onSelectBot,
  onOpenStudio,
  variant = 'vertical',
}: {
  personas: Persona[];
  activePersonaId: string | null;
  selectedBotId: string | null;
  busyPersonaIds: ReadonlySet<string>;
  onSelectBot: (id: string) => void;
  onOpenStudio: () => void;
  variant?: 'vertical' | 'horizontal';
}) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const horizontal = variant === 'horizontal';
  const highlightedId = selectedBotId ?? activePersonaId;

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, personas.length);
  }, [personas.length]);

  function moveFocus(index: number, delta: number) {
    if (personas.length === 0) return;
    const next = (index + delta + personas.length) % personas.length;
    buttonRefs.current[next]?.focus();
  }

  return (
    <aside
      aria-label="Bots"
      className={
        horizontal
          ? 'flex h-16 min-w-0 items-center gap-2 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-3 md:hidden'
          : 'hidden w-[72px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)] md:flex'
      }
    >
      <div
        className={
          horizontal
            ? 'flex shrink-0 items-center gap-2'
            : 'flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-1.5 py-3'
        }
      >
        {!horizontal && (
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Bots
          </div>
        )}
        <div className={horizontal ? 'flex items-center gap-2' : 'flex w-full flex-col items-center gap-2'}>
          {personas.map((persona, index) => {
            const palette = mascotPalette(persona.avatar);
            const selected = highlightedId === persona.id;
            const busy = busyPersonaIds.has(persona.id);
            return (
              <button
                key={persona.id}
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                title={persona.name}
                aria-label={persona.name}
                aria-pressed={selected}
                onClick={() => onSelectBot(persona.id)}
                onKeyDown={(event) => {
                  const previousKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
                  const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
                  if (event.key === previousKey || event.key === nextKey) {
                    event.preventDefault();
                    moveFocus(index, event.key === previousKey ? -1 : 1);
                  }
                }}
                className={`relative flex shrink-0 flex-col items-center rounded-xl p-1.5 text-[10px] text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] ${
                  horizontal ? 'w-11' : 'w-full'
                }`}
                style={
                  selected
                    ? {
                        backgroundColor: palette.glow,
                        boxShadow: `inset 0 0 0 2px ${palette.primary}`,
                        color: palette.primary,
                      }
                    : undefined
                }
              >
                <span className="relative">
                  <Mascot avatar={persona.avatar} size={horizontal ? 32 : 40} alt={persona.name} />
                  {busy && (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[var(--surface)] bg-[var(--success)]"
                      aria-label="En train de répondre"
                    />
                  )}
                </span>
                {!horizontal && <span className="mt-1 w-full truncate">{persona.name}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenStudio}
        className={horizontal ? 'btn btn-icon mb-0 shrink-0' : 'btn btn-icon mb-3'}
        aria-label="Créer un bot"
        title="Créer un bot"
      >
        <IconPlus />
      </button>
    </aside>
  );
}
