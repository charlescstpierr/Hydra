'use client';

import { useState } from 'react';
import type { Memory } from '@/lib/db';

export function MemoryPanel({
  conversationId,
  memories,
  onClose,
  onChange,
}: {
  conversationId: string | null;
  memories: Memory[];
  onClose: () => void;
  onChange: () => Promise<void> | void;
}) {
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<'global' | 'conversation'>('global');

  async function add() {
    if (!content.trim()) return;
    await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, scope, conversationId }),
    });
    setContent('');
    await onChange();
  }

  async function remove(id: string) {
    await fetch(`/api/memories?id=${id}`, { method: 'DELETE' });
    await onChange();
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold">🧠 Mémoire</span>
        <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {memories.length === 0 && (
          <p className="text-xs text-[var(--muted)]">
            Hydra retient automatiquement tes préférences et décisions au fil des échanges.
          </p>
        )}
        {memories.map((memory) => (
          <div
            key={memory.id}
            className="group rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 text-xs"
          >
            <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
              {memory.scope === 'global' ? 'globale' : 'conversation'}
            </div>
            <div className="flex items-start gap-2">
              <p className="flex-1">{memory.content}</p>
              <button
                onClick={() => void remove(memory.id)}
                className="invisible text-[var(--muted)] group-hover:visible hover:text-red-400"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-[var(--border)] p-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          placeholder="Ajouter un souvenir…"
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 text-xs outline-none"
        />
        <div className="flex items-center gap-2">
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as 'global' | 'conversation')}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs"
          >
            <option value="global">Globale</option>
            <option value="conversation" disabled={!conversationId}>
              Cette conversation
            </option>
          </select>
          <button
            onClick={() => void add()}
            className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white"
          >
            Ajouter
          </button>
        </div>
      </div>
    </aside>
  );
}
