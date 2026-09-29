import { nanoid } from 'nanoid';
import { deleteMemory, insertMemory, listMemories } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const conversationId = new URL(request.url).searchParams.get('conversationId');
  return Response.json({ memories: listMemories(conversationId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    content?: string;
    scope?: 'global' | 'conversation';
    conversationId?: string | null;
  };

  const content = body.content?.trim();
  if (!content) return Response.json({ error: 'Contenu requis' }, { status: 400 });

  const scope = body.scope === 'conversation' ? 'conversation' : 'global';
  if (scope === 'conversation' && !body.conversationId) {
    return Response.json({ error: 'conversationId requis pour une mémoire de conversation' }, { status: 400 });
  }

  const memory = insertMemory({
    id: nanoid(),
    scope,
    conversationId: scope === 'conversation' ? body.conversationId! : null,
    content,
  });

  return Response.json({ memory }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id requis' }, { status: 400 });
  deleteMemory(id);
  return new Response(null, { status: 204 });
}
