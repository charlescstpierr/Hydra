import { getAttachment } from '@/lib/db';
import { readAttachment } from '@/lib/files';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const attachment = getAttachment(id);
  if (!attachment) return new Response('Not found', { status: 404 });

  const data = await readAttachment(attachment);
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': attachment.media_type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.name)}"`,
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
