import { nanoid } from 'nanoid';
import { createPersona, listPersonas } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ personas: listPersonas() });
}

export async function POST(request: Request) {
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

  if (!body.name?.trim() || !body.instructions?.trim()) {
    return Response.json({ error: 'name et instructions sont requis' }, { status: 400 });
  }

  const persona = createPersona({
    id: nanoid(),
    name: body.name.trim(),
    avatar: body.avatar?.trim() || 'persona-default',
    tagline: body.tagline?.trim() ?? '',
    instructions: body.instructions.trim(),
    greeting: body.greeting?.trim() || null,
    tone: body.tone?.trim() || null,
    preferredModel: body.preferredModel ?? null,
    voice: body.voice ?? null,
    voiceSpeed: body.voiceSpeed ?? null,
    voiceLanguage: body.voiceLanguage ?? null,
  });

  return Response.json({ persona }, { status: 201 });
}
