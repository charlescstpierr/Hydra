import { getPersona } from '@/lib/db';
import { synthesize } from '@/lib/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text?: string;
    voice?: string | null;
    speed?: number | null;
    language?: string | null;
    personaId?: string | null;
  };

  if (!body.text?.trim()) return Response.json({ error: 'Texte requis' }, { status: 400 });

  const persona = body.personaId ? getPersona(body.personaId) : undefined;

  try {
    const { data, mediaType } = await synthesize({
      text: body.text,
      voice: body.voice ?? persona?.voice ?? null,
      speed: body.speed ?? persona?.voice_speed ?? null,
      language: body.language ?? persona?.voice_language ?? null,
    });
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': mediaType, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
