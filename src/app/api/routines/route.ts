import { nanoid } from 'nanoid';
import { createRoutine, listRoutines } from '@/lib/agent-store';
import { getPersona } from '@/lib/db';
import { parseSchedule } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const personaId = new URL(request.url).searchParams.get('personaId') ?? undefined;
  return Response.json({ routines: listRoutines(personaId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    personaId?: string;
    name?: string;
    instructions?: string;
    schedule?: unknown;
  };
  const schedule = parseSchedule(body.schedule);
  if (!body.personaId || !getPersona(body.personaId) || !body.name?.trim() || !body.instructions?.trim() || !schedule) {
    return Response.json({ error: 'Bot, nom, instructions et horaire requis' }, { status: 400 });
  }
  const routine = createRoutine({
    id: nanoid(),
    personaId: body.personaId,
    name: body.name.trim(),
    instructions: body.instructions.trim(),
    schedule,
  });
  return Response.json({ routine }, { status: 201 });
}
