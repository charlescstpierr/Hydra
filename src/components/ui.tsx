'use client';

import { useEffect, useId, useRef } from 'react';
import { IconClose } from '@/components/icons';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
        <span aria-hidden="true">∅</span>
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="space-y-2 p-3" role="status" aria-label={label}>
      <div className="skeleton h-12 rounded-xl" />
      <div className="skeleton h-12 rounded-xl" />
      <div className="skeleton h-12 w-4/5 rounded-xl" />
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="m-3 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn mt-2 border border-[var(--danger)]/40 px-2 py-1 text-xs">
          Réessayer
        </button>
      )}
    </div>
  );
}

export function SidePanel({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside
      aria-labelledby={titleId}
      className="glass fixed inset-y-0 right-0 z-40 flex w-full max-w-[320px] shrink-0 flex-col border-l border-[var(--border)] shadow-2xl md:relative md:z-auto md:shadow-none"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        <button ref={closeRef} onClick={onClose} className="btn btn-icon text-[var(--muted)]" aria-label={`Fermer ${title.toLowerCase()}`}>
          <IconClose />
        </button>
      </div>
      {children}
    </aside>
  );
}
