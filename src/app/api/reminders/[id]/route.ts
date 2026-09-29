import { deleteReminder, setReminderStatus, type Reminder } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUSES: Reminder['status'][] = ['pending', 'done', 'cancelled'];

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };

  const status = STATUSES.find((s) => s === body.status);
  if (!status) return Response.json({ error: 'Statut invalide' }, { status: 400 });

  setReminderStatus(id, status);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteReminder(id);
  return Response.json({ ok: true });
}
