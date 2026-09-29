'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Reminder } from '@/lib/db';
import { IconReminder } from '@/components/icons';
import { EmptyState, ErrorState, LoadingState, SidePanel } from '@/components/ui';

const formatter = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'short', timeStyle: 'short' });

export function RemindersPanel({
  conversationId,
  onClose,
}: {
  conversationId: string | null;
  onClose: () => void;
}) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [now, setNow] = useState(0);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reminders');
      if (!res.ok) throw new Error('Rappels indisponibles.');
      const data = (await res.json()) as { reminders: Reminder[] };
      setReminders(data.reminders);
      setNow(Date.now());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);

  async function add() {
    if (!title.trim() || !dueAt) return;
    await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, dueAt: new Date(dueAt).toISOString(), conversationId }),
    });
    setTitle('');
    setDueAt('');
    await refresh();
  }

  async function patch(id: string, status: Reminder['status']) {
    await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm('Supprimer ce rappel ?')) return;
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <SidePanel title="Rappels" icon={<IconReminder />} onClose={onClose}>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
        {loading ? <LoadingState label="Chargement des rappels" /> : error ? <ErrorState message={error} onRetry={() => void refresh()} /> : reminders.length === 0 && <EmptyState title="Aucun rappel" description="Demande aussi à Hydra « rappelle-moi… » dans le chat." />}
        {reminders.map((reminder) => {
          const due = new Date(reminder.due_at);
          const overdue = reminder.status === 'pending' && due.getTime() <= now;
          return (
            <div
              key={reminder.id}
              className={`card p-2.5 ${overdue ? 'border-[rgba(124,92,255,0.6)]' : ''}`}
            >
              <div className={reminder.status === 'done' ? 'line-through opacity-60' : ''}>
                {reminder.title}
              </div>
              <div className="text-[11px] text-[var(--muted)]">
                {formatter.format(due)}
                {overdue ? ' · échu' : ''}
              </div>
              {reminder.details && (
                <div className="mt-1 text-[11px] text-[var(--muted)]">{reminder.details}</div>
              )}
              <div className="mt-2 flex gap-2 text-[11px] text-[var(--muted)]">
                {reminder.status !== 'done' && (
                <button onClick={() => void patch(reminder.id, 'done')} className="btn px-1 py-0.5 text-[11px] hover:text-[var(--foreground)]">
                    Terminé
                  </button>
                )}
                {reminder.status === 'pending' && (
                  <button
                    onClick={() => void patch(reminder.id, 'cancelled')}
                    className="btn px-1 py-0.5 text-[11px] hover:text-[var(--foreground)]"
                  >
                    Annuler
                  </button>
                )}
                <button onClick={() => void remove(reminder.id)} className="btn px-1 py-0.5 text-[11px] hover:text-[var(--danger)]">
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-[var(--border)] p-3 text-xs">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nouveau rappel"
          className="field w-full"
        />
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="field w-full"
        />
        <button
          onClick={() => void add()}
          className="btn btn-primary w-full"
        >
          Ajouter
        </button>
      </div>
    </SidePanel>
  );
}
