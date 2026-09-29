import { nanoid } from 'nanoid';
import {
  createConversation,
  getPersona,
  insertMessage,
  listConversations,
} from '@/lib/db';
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

  const persona = body.personaId ? getPersona(body.personaId) : undefined;
  const conversation = createConversation({
    id: nanoid(),
    title: body.title ?? (persona ? `Chat avec ${persona.name}` : undefined),
    persona: body.persona,
    personaId: body.personaId ?? null,
    parentId: body.parentId ?? null,
    defaultModel: body.defaultModel ?? persona?.preferred_model ?? defaultModelId(),
  });

  if (persona?.greeting?.trim() && !body.parentId) {
    insertMessage({
      id: nanoid(),
      conversationId: conversation.id,
      role: 'assistant',
      content: persona.greeting.trim(),
    });
  }

  return Response.json({ conversation }, { status: 201 });
}
