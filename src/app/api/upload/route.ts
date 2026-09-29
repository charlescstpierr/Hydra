import { attachmentUrl, storeFile } from '@/lib/files';

export const dynamic = 'force-dynamic';

const MAX_SIZE = Number(process.env.MAX_UPLOAD_BYTES ?? 20 * 1024 * 1024);

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  const conversationId = form.get('conversationId');

  if (!(file instanceof File)) {
    return Response.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: `Fichier trop volumineux (max ${MAX_SIZE} octets)` }, { status: 413 });
  }

  const attachment = await storeFile({
    data: new Uint8Array(await file.arrayBuffer()),
    name: file.name || 'fichier',
    mediaType: file.type || 'application/octet-stream',
    conversationId: typeof conversationId === 'string' ? conversationId : null,
  });

  return Response.json({ attachment, url: attachmentUrl(attachment.id) }, { status: 201 });
}
