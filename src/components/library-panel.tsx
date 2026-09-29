'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AttachmentKind } from '@/lib/db';
import { IconClose, IconLibrary } from '@/components/icons';

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
    <aside className="glass flex w-[320px] shrink-0 flex-col border-l border-[var(--border)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-semibold"><IconLibrary />Bibliothèque</span>
        <button onClick={onClose} className="btn btn-icon text-[var(--muted)]">
          <IconClose />
        </button>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)] p-2 text-[11px]">
        {(['all', 'generated', 'upload'] as Filter[]).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`chip ${filter === value ? 'chip-active' : ''}`}
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
            className="card block p-2.5"
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
