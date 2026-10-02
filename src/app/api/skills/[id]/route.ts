import { deleteSkill, updateSkill } from '@/lib/agent-store';
import { slugify } from '@/lib/mentions';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    slug?: string;
    instructions?: string;
  };
  updateSkill(id, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.slug !== undefined ? { slug: slugify(body.slug) } : {}),
    ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
  });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  deleteSkill(id);
  return new Response(null, { status: 204 });
}
