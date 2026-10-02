import { duplicatePersona, publicPersona } from '@/lib/agent-store';
import { deletePersona, getPersona, updatePersona } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const persona = getPersona(id);
  if (!persona) return Response.json({ error: 'Persona introuvable' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    avatar?: string;
    tagline?: string;
    instructions?: string;
    greeting?: string | null;
    tone?: string | null;
    preferredModel?: string | null;
    voice?: string | null;
    voiceSpeed?: number | null;
    voiceLanguage?: string | null;
  };

  updatePersona(id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
    ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
    ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
    ...(body.greeting !== undefined ? { greeting: body.greeting } : {}),
    ...(body.tone !== undefined ? { tone: body.tone } : {}),
    ...(body.preferredModel !== undefined ? { preferred_model: body.preferredModel } : {}),
    ...(body.voice !== undefined ? { voice: body.voice } : {}),
    ...(body.voiceSpeed !== undefined ? { voice_speed: body.voiceSpeed } : {}),
    ...(body.voiceLanguage !== undefined ? { voice_language: body.voiceLanguage } : {}),
  });

  return Response.json({ persona: getPersona(id) });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  const persona = getPersona(id);
  if (!persona) return Response.json({ error: 'Persona introuvable' }, { status: 404 });
  if (body.action === 'duplicate') {
    return Response.json({ persona: duplicatePersona(id) }, { status: 201 });
  }
  if (body.action === 'export') {
    return Response.json({ persona: publicPersona(persona) });
  }
  return Response.json({ error: 'Action inconnue' }, { status: 400 });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deletePersona(id);
  return new Response(null, { status: 204 });
}
