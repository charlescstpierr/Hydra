import { toggleReaction } from '@/lib/agent-store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { emoji?: string };
  const emoji = body.emoji?.trim();
  if (!emoji || emoji.length > 8) return Response.json({ error: 'Réaction invalide' }, { status: 400 });
  return Response.json({ reactions: toggleReaction(id, emoji) });
}
