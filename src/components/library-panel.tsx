'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AttachmentKind } from '@/lib/db';

interface LibraryItem {
  id: string;
  name: string;
  kind: AttachmentKind;
  origin: 'upload' | 'generated';
  mediaType: string;
  size: number;
  createdAt: string;
  url: string;
}

const ICONS: Record<AttachmentKind, string> = {
  image: '🖼',
  document: '📄',
  spreadsheet: '📊',
  audio: '🎧',
  file: '📎',
};

type Filter = 'all' | 'generated' | 'upload';

export function LibraryPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/library');
    const data = (await res.json()) as { items: LibraryItem[] };
    setItems(data.items);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const visible = items.filter((item) => filter === 'all' || item.origin === filter);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold">📚 Bibliothèque</span>
        <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
          ✕
        </button>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] p-2 text-[11px]">
        {(['all', 'generated', 'upload'] as Filter[]).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-lg px-2 py-1 ${
              filter === value ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--surface-2)]'
            }`}
          >
            {value === 'all' ? 'Tout' : value === 'generated' ? 'Artefacts' : 'Uploads'}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
        {visible.length === 0 && <p className="text-[var(--muted)]">Rien pour le moment.</p>}
        {visible.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2 hover:border-[var(--accent)]"
          >
            <div className="truncate">
              {ICONS[item.kind]} {item.name}
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              {Math.max(1, Math.round(item.size / 1024))} Ko ·{' '}
              {new Date(item.createdAt).toLocaleDateString('fr-CA')}
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
}
