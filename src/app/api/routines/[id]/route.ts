import { deleteRoutine, listRoutineRuns, updateRoutine } from '@/lib/agent-store';
import { parseSchedule } from '@/lib/schedule';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return Response.json({ runs: listRoutineRuns(id) });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    instructions?: string;
    schedule?: unknown;
    enabled?: boolean;
  };
  const schedule = body.schedule === undefined ? undefined : parseSchedule(body.schedule);
  if (body.schedule !== undefined && !schedule) {
    return Response.json({ error: 'Horaire invalide' }, { status: 400 });
  }
  updateRoutine(id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
    ...(schedule ? { schedule } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
  });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteRoutine(id);
  return new Response(null, { status: 204 });
}
