'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Reminder } from '@/lib/db';

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

  const refresh = useCallback(async () => {
    const res = await fetch('/api/reminders');
    const data = (await res.json()) as { reminders: Reminder[] };
    setReminders(data.reminders);
    setNow(Date.now());
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
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold">⏰ Rappels</span>
        <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
        {reminders.length === 0 && (
          <p className="text-[var(--muted)]">
            Aucun rappel. Tu peux aussi demander « rappelle-moi… » dans le chat.
          </p>
        )}
        {reminders.map((reminder) => {
          const due = new Date(reminder.due_at);
          const overdue = reminder.status === 'pending' && due.getTime() <= now;
          return (
            <div
              key={reminder.id}
              className={`rounded-lg border p-2 ${
                overdue ? 'border-[var(--accent)]' : 'border-[var(--border)]'
              } bg-[var(--surface-2)]`}
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
                  <button onClick={() => void patch(reminder.id, 'done')} className="hover:text-[var(--foreground)]">
                    Terminé
                  </button>
                )}
                {reminder.status === 'pending' && (
                  <button
                    onClick={() => void patch(reminder.id, 'cancelled')}
                    className="hover:text-[var(--foreground)]"
                  >
                    Annuler
                  </button>
                )}
                <button onClick={() => void remove(reminder.id)} className="hover:text-red-400">
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
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
        />
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
        />
        <button
          onClick={() => void add()}
          className="w-full rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-white"
        >
          Ajouter
        </button>
      </div>
    </aside>
  );
}
