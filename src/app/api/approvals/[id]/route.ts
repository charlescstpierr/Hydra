import { resolveApproval } from '@/lib/approvals';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { decision?: 'approve' | 'reject' };
  if (body.decision !== 'approve' && body.decision !== 'reject') {
    return Response.json({ error: 'Décision attendue : approve ou reject' }, { status: 400 });
  }
  try {
    const approval = await resolveApproval(id, body.decision);
    return Response.json({ approval });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 404 });
  }
}
