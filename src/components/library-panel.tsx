'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AttachmentKind } from '@/lib/db';
import {
  IconClip,
  IconDocument,
  IconImage,
  IconLibrary,
  IconSpeaker,
  IconTable,
} from '@/components/icons';
import { EmptyState, ErrorState, LoadingState, SidePanel } from '@/components/ui';

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

const ICONS: Record<AttachmentKind, (props: { className?: string }) => React.ReactElement> = {
  image: IconImage,
  document: IconDocument,
  spreadsheet: IconTable,
  audio: IconSpeaker,
  file: IconClip,
};

type Filter = 'all' | 'generated' | 'upload';

export function LibraryPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/library');
      if (!res.ok) throw new Error('Bibliothèque indisponible.');
      const data = (await res.json()) as { items: LibraryItem[] };
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const visible = items.filter((item) => filter === 'all' || item.origin === filter);

  return (
    <SidePanel title="Bibliothèque" icon={<IconLibrary />} onClose={onClose}>

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
        {loading ? <LoadingState label="Chargement de la bibliothèque" /> : error ? <ErrorState message={error} onRetry={() => void refresh()} /> : visible.length === 0 && <EmptyState title="Aucun fichier" description="Les uploads et artefacts apparaîtront ici." />}
        {visible.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="card block p-2.5"
          >
            <div className="flex items-center gap-2 truncate">
              {(() => {
                const Icon = ICONS[item.kind];
                return <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />;
              })()}
              <span className="truncate">{item.name}</span>
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              {Math.max(1, Math.round(item.size / 1024))} Ko ·{' '}
              {new Date(item.createdAt).toLocaleDateString('fr-CA')}
            </div>
          </a>
        ))}
      </div>
    </SidePanel>
  );
}
