import { nanoid } from 'nanoid';
import { createSkill, listSkills } from '@/lib/agent-store';
import { slugify } from '@/lib/mentions';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ skills: listSkills() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    instructions?: string;
  };
  const name = body.name?.trim();
  const instructions = body.instructions?.trim();
  if (!name || !instructions) {
    return Response.json({ error: 'Nom et instructions requis' }, { status: 400 });
  }
  const slug = slugify(body.slug?.trim() || name);
  try {
    const skill = createSkill({ id: nanoid(), slug, name, instructions });
    return Response.json({ skill }, { status: 201 });
  } catch {
    return Response.json({ error: 'Ce raccourci existe déjà' }, { status: 409 });
  }
}
