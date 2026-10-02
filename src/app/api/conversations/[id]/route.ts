import { listActivities, listApprovals, listReactions } from '@/lib/agent-store';
import {
  deleteConversation,
  getConversation,
  listAttachments,
  listMemories,
  listMessages,
  listSideChats,
  memoryRootId,
  updateConversation,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const conversation = getConversation(id);
  if (!conversation) return Response.json({ error: 'Conversation introuvable' }, { status: 404 });

  const messages = listMessages(id);
  return Response.json({
    conversation,
    messages,
    memories: listMemories(memoryRootId(id)),
    attachments: listAttachments(messages.map((m) => m.id)),
    sideChats: listSideChats(id),
    activities: listActivities(id),
    reactions: listReactions(messages.map((message) => message.id)),
    approvals: listApprovals(id),
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getConversation(id)) return Response.json({ error: 'Conversation introuvable' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    persona?: string;
    personaId?: string | null;
    defaultModel?: string;
  };

  updateConversation(id, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.persona !== undefined ? { persona: body.persona } : {}),
    ...(body.personaId !== undefined ? { persona_id: body.personaId } : {}),
    ...(body.defaultModel !== undefined ? { default_model: body.defaultModel } : {}),
  });

  return Response.json({ conversation: getConversation(id) });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteConversation(id);
  return new Response(null, { status: 204 });
}
