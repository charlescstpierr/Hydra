import { nanoid } from 'nanoid';
import { createConversation, listConversations } from '@/lib/db';
import { defaultModelId } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ conversations: listConversations() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    persona?: string;
    personaId?: string | null;
    parentId?: string | null;
    defaultModel?: string;
  };

  const conversation = createConversation({
    id: nanoid(),
    title: body.title,
    persona: body.persona,
    personaId: body.personaId ?? null,
    parentId: body.parentId ?? null,
    defaultModel: body.defaultModel ?? defaultModelId(),
  });

  return Response.json({ conversation }, { status: 201 });
}
