import { listLibrary } from '@/lib/db';
import { attachmentUrl } from '@/lib/files';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = listLibrary().map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    kind: attachment.kind,
    origin: attachment.origin,
    mediaType: attachment.media_type,
    size: attachment.size,
    conversationId: attachment.conversation_id,
    createdAt: attachment.created_at,
    url: attachmentUrl(attachment.id),
  }));
  return Response.json({ items });
}
