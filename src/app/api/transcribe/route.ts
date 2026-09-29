import { speechToText } from '@/lib/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get('audio');
  const language = form.get('language');
  if (!(audio instanceof File)) return Response.json({ error: 'Audio manquant' }, { status: 400 });

  try {
    const text = await speechToText({
      data: new Uint8Array(await audio.arrayBuffer()),
      filename: audio.name || 'audio.webm',
      mediaType: audio.type || 'audio/webm',
      language: typeof language === 'string' && language ? language : null,
    });
    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
