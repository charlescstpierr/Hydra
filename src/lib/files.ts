import { mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { nanoid } from 'nanoid';
import { insertAttachment, type Attachment, type AttachmentKind } from './db';

const UPLOAD_DIR = resolve(process.env.HYDRA_UPLOAD_DIR ?? './data/uploads');

function defaultKind(mediaType: string): AttachmentKind {
  if (mediaType.startsWith('image/')) return 'image';
  if (mediaType.startsWith('audio/')) return 'audio';
  if (mediaType === 'text/csv') return 'spreadsheet';
  if (mediaType === 'text/markdown' || mediaType === 'application/pdf') return 'document';
  return 'file';
}

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
  'text/html': '.html',
  'audio/mpeg': '.mp3',
};

export function attachmentUrl(id: string): string {
  return `/api/files/${id}`;
}

export async function storeFile(input: {
  data: Uint8Array;
  name: string;
  mediaType: string;
  conversationId?: string | null;
  kind?: AttachmentKind;
  origin?: 'upload' | 'generated';
}): Promise<Attachment> {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const id = nanoid();
  const ext = extname(input.name) || EXTENSIONS[input.mediaType] || '';
  const path = join(UPLOAD_DIR, `${id}${ext}`);
  await writeFile(path, input.data);

  return insertAttachment({
    id,
    conversationId: input.conversationId ?? null,
    kind: input.kind ?? defaultKind(input.mediaType),
    origin: input.origin ?? 'upload',
    name: input.name,
    mediaType: input.mediaType,
    size: input.data.byteLength,
    path,
  });
}

export async function readAttachment(attachment: Attachment): Promise<Buffer> {
  return readFile(attachment.path);
}
