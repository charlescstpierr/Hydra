import { deletePersona, getPersona, updatePersona } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const persona = getPersona(id);
  if (!persona) return Response.json({ error: 'Persona introuvable' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    emoji?: string;
    tagline?: string;
    instructions?: string;
    preferredModel?: string | null;
    voice?: string | null;
    voiceSpeed?: number | null;
    voiceLanguage?: string | null;
  };

  updatePersona(id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.emoji !== undefined ? { emoji: body.emoji } : {}),
    ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
    ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
    ...(body.preferredModel !== undefined ? { preferred_model: body.preferredModel } : {}),
    ...(body.voice !== undefined ? { voice: body.voice } : {}),
    ...(body.voiceSpeed !== undefined ? { voice_speed: body.voiceSpeed } : {}),
    ...(body.voiceLanguage !== undefined ? { voice_language: body.voiceLanguage } : {}),
  });

  return Response.json({ persona: getPersona(id) });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deletePersona(id);
  return new Response(null, { status: 204 });
}
