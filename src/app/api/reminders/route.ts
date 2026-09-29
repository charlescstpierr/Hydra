import { nanoid } from 'nanoid';
import { insertReminder, listReminders } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ reminders: listReminders() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    details?: string | null;
    dueAt?: string;
    conversationId?: string | null;
  };

  const due = body.dueAt ? new Date(body.dueAt) : null;
  if (!body.title?.trim() || !due || Number.isNaN(due.getTime())) {
    return Response.json({ error: 'title et dueAt (ISO 8601) sont requis' }, { status: 400 });
  }

  const reminder = insertReminder({
    id: nanoid(),
    conversationId: body.conversationId ?? null,
    title: body.title.trim(),
    details: body.details ?? null,
    dueAt: due.toISOString(),
  });

  return Response.json({ reminder }, { status: 201 });
}
