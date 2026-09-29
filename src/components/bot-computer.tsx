'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Conversation, Memory, Persona, Reminder, AttachmentKind } from '@/lib/db';
import { IconClock, IconDocument, IconImage, IconLibrary, IconSpeaker, IconTable } from '@/components/icons';
import { Mascot, mascotPalette } from '@/components/mascot';
import { EmptyState, ErrorState, LoadingState, SidePanel } from '@/components/ui';

interface LibraryItem {
  id: string;
  name: string;
  kind: AttachmentKind;
  size: number;
  conversationId: string | null;
  url: string;
}

type Tab = 'conversations' | 'files' | 'memory' | 'reminders' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'conversations', label: 'Conversations' },
  { id: 'files', label: 'Fichiers' },
  { id: 'memory', label: 'Mémoire' },
  { id: 'reminders', label: 'Rappels' },
  { id: 'settings', label: 'Réglages' },
];

const FILE_ICONS: Record<AttachmentKind, (props: { className?: string }) => React.ReactElement> = {
  image: IconImage,
  document: IconDocument,
  spreadsheet: IconTable,
  audio: IconSpeaker,
  file: IconLibrary,
};

const dateFormatter = new Intl.DateTimeFormat('fr-CA', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function relativeDate(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.round(elapsed / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return dateFormatter.format(new Date(value));
}

function formatSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BotComputer({
  persona,
  conversations,
  currentConversationId,
  streamingConversationId,
  onOpenConversation,
  onNewConversation,
  onEditBot,
  onClose,
}: {
  persona: Persona;
  conversations: Conversation[];
  currentConversationId: string | null;
  streamingConversationId: string | null;
  onOpenConversation: (id: string) => void;
  onNewConversation: (personaId: string) => void;
  onEditBot: (personaId: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('conversations');
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<LibraryItem[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [globalMemory, setGlobalMemory] = useState<Memory[]>([]);
  const palette = mascotPalette(persona.avatar);
  const conversationIds = useMemo(() => new Set(conversations.map((item) => item.id)), [conversations]);
  const isStreaming = streamingConversationId !== null && conversationIds.has(streamingConversationId);

  useEffect(() => {
    if (tab === 'conversations' || loadedTabs.has(tab)) return;
    let cancelled = false;
    (async () => {
      try {
        if (tab === 'files') {
          const res = await fetch('/api/library');
          if (!res.ok) throw new Error('Fichiers indisponibles.');
          const data = (await res.json()) as { items: LibraryItem[] };
          if (!cancelled) setFiles(data.items.filter((item) => item.conversationId && conversationIds.has(item.conversationId)));
        } else if (tab === 'memory') {
          const responses = await Promise.all([
            fetch('/api/memories'),
            [...conversationIds].map((id) => fetch(`/api/memories?conversationId=${encodeURIComponent(id)}`)),
          ].flat());
          if (responses.some((res) => !res.ok)) throw new Error('Mémoire indisponible.');
          const all = (await Promise.all(responses.map((res) => res.json()))) as { memories: Memory[] }[];
          const scoped = all.flatMap((entry) => entry.memories).filter((memory) => memory.scope === 'conversation' && memory.conversation_id && conversationIds.has(memory.conversation_id));
          const globals = all.flatMap((entry) => entry.memories).filter((memory) => memory.scope === 'global');
          if (!cancelled) {
            setMemories([...new Map(scoped.map((memory) => [memory.id, memory])).values()]);
            setGlobalMemory([...new Map(globals.map((memory) => [memory.id, memory])).values()]);
          }
        } else if (tab === 'reminders') {
          const res = await fetch('/api/reminders');
          if (!res.ok) throw new Error('Rappels indisponibles.');
          const data = (await res.json()) as { reminders: Reminder[] };
          if (!cancelled) setReminders(data.reminders.filter((item) => item.conversation_id && conversationIds.has(item.conversation_id)));
        }
        if (!cancelled) setLoadedTabs((current) => new Set(current).add(tab));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationIds, loadedTabs, tab]);

  function selectTab(next: Tab) {
    if (next !== 'conversations' && !loadedTabs.has(next)) {
      setLoading(true);
      setError(null);
    }
    setTab(next);
  }

  function retryTab() {
    setLoadedTabs((current) => {
      const next = new Set(current);
      next.delete(tab);
      return next;
    });
    setLoading(true);
    setError(null);
  }

  return (
    <SidePanel
      title={`Ordinateur de ${persona.name}`}
      icon={<Mascot avatar={persona.avatar} size={18} alt="" />}
      onClose={onClose}
      className="md:max-w-[380px]"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--background)]">
            <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.primary }} />
              ))}
              <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Screen</span>
            </div>
            <div className="flex flex-col items-center px-4 py-5 text-center">
              <Mascot avatar={persona.avatar} size={64} alt={persona.name} />
              <h3 className="mt-3 text-sm font-semibold">{persona.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{persona.tagline}</p>
              <div
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]"
                style={{ backgroundColor: palette.glow, color: palette.primary }}
              >
                <span className={`h-1.5 w-1.5 rounded-full bg-current ${isStreaming ? 'animate-pulse' : ''}`} />
                {isStreaming ? 'En train de répondre…' : 'En ligne'}
              </div>
              <p className="mt-3 text-[10px] text-[var(--muted)]">
                {conversations.length} conversations · modèle {persona.preferred_model ?? 'par défaut'} · voix {persona.voice ?? '—'}
              </p>
            </div>
          </div>
        </div>

        <div role="tablist" aria-label="Contenu du bot" className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 pb-2">
          {TABS.map((item, index) => (
            <button
              key={item.id}
              id={`bot-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`bot-tabpanel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => selectTab(item.id)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
                selectTab(TABS[next].id);
                document.getElementById(`bot-tab-${TABS[next].id}`)?.focus();
              }}
              className={`chip shrink-0 ${tab === item.id ? 'chip-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div id={`bot-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`bot-tab-${tab}`} className="p-3 text-xs">
          {tab === 'conversations' && (
            <>
              <button
                type="button"
                onClick={() => onNewConversation(persona.id)}
                className="btn btn-primary mb-3 w-full"
              >
                Nouvelle conversation
              </button>
              {conversations.length === 0 ? (
                <EmptyState title="Aucune conversation" description="Lance une conversation avec ce bot pour la voir ici." />
              ) : (
                <div className="space-y-2">
                  {[...conversations].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onOpenConversation(item.id)}
                      className={`card block w-full p-2.5 text-left ${currentConversationId === item.id ? 'border-[var(--accent)] bg-[var(--surface-2)]' : ''}`}
                    >
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--muted)]">
                        <IconClock className="h-3 w-3" /> {relativeDate(item.updated_at)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'files' && (
            loading ? <LoadingState label="Chargement des fichiers" /> : error ? <ErrorState message={error} onRetry={retryTab} /> : files.length === 0 ? <EmptyState title="Aucun fichier" description="Les fichiers de ce bot apparaîtront ici." /> : (
              <div className="space-y-2">
                {files.map((item) => {
                  const Icon = FILE_ICONS[item.kind];
                  return (
                    <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="card flex items-center gap-2 p-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-[var(--muted)]" />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <span className="shrink-0 text-[10px] text-[var(--muted)]">
                        {item.kind} · {formatSize(item.size)}
                      </span>
                    </a>
                  );
                })}
              </div>
            )
          )}

          {tab === 'memory' && (
            loading ? <LoadingState label="Chargement de la mémoire" /> : error ? <ErrorState message={error} onRetry={retryTab} /> : (
              <div className="space-y-3">
                {memories.length === 0 ? <EmptyState title="Aucune mémoire" description="Les souvenirs de ce bot apparaîtront ici." /> : memories.map((memory) => <div key={memory.id} className="card p-2.5">{memory.content}</div>)}
                <details className="card p-2.5">
                  <summary className="cursor-pointer font-medium">Mémoire globale ({globalMemory.length})</summary>
                  <div className="mt-2 space-y-2 text-[var(--muted)]">
                    {globalMemory.length === 0 ? <p>Aucun souvenir global.</p> : globalMemory.map((memory) => <p key={memory.id}>{memory.content}</p>)}
                  </div>
                </details>
              </div>
            )
          )}

          {tab === 'reminders' && (
            loading ? <LoadingState label="Chargement des rappels" /> : error ? <ErrorState message={error} onRetry={retryTab} /> : reminders.length === 0 ? <EmptyState title="Aucun rappel" description="Les rappels liés à ce bot apparaîtront ici." /> : (
              <div className="space-y-2">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="card p-2.5">
                    <div className={reminder.status === 'done' ? 'line-through opacity-60' : ''}>{reminder.title}</div>
                    <div className="mt-1 text-[11px] text-[var(--muted)]">{new Date(reminder.due_at).toLocaleString('fr-CA')}</div>
                    {reminder.details && <div className="mt-1 text-[11px] text-[var(--muted)]">{reminder.details}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'settings' && (
            <div className="space-y-3">
              <div className="card space-y-2 p-3">
                <div><span className="text-[var(--muted)]">Instructions</span><p className="mt-1 line-clamp-6">{persona.instructions}</p></div>
                <div><span className="text-[var(--muted)]">Ton</span><p className="mt-1">{persona.tone || '—'}</p></div>
                <div><span className="text-[var(--muted)]">Message d’accueil</span><p className="mt-1">{persona.greeting || '—'}</p></div>
                <div><span className="text-[var(--muted)]">Modèle</span><p className="mt-1">{persona.preferred_model || 'Par défaut'}</p></div>
                <div><span className="text-[var(--muted)]">Voix</span><p className="mt-1">{persona.voice || '—'} · vitesse {persona.voice_speed ?? 1} · langue {persona.voice_language || '—'}</p></div>
              </div>
              <button type="button" onClick={() => onEditBot(persona.id)} className="btn btn-outline w-full">
                Modifier dans le studio
              </button>
            </div>
          )}
        </div>
      </div>
    </SidePanel>
  );
}
