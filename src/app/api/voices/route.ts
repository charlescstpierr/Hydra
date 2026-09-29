import { cloneVoice, listVoices, voiceCloningAvailable, voiceProvider } from '@/lib/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  return Response.json({
    provider: voiceProvider(),
    cloning: voiceCloningAvailable(),
    voices: await listVoices(),
  });
}

/** Clones a voice from a reference clip (xAI only). */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get('file');
  const name = form.get('name');
  const language = form.get('language');

  if (!(file instanceof File) || typeof name !== 'string' || !name.trim()) {
    return Response.json({ error: 'name et file sont requis' }, { status: 400 });
  }

  try {
    const voiceId = await cloneVoice({
      name: name.trim(),
      language: typeof language === 'string' && language ? language : 'fr',
      data: new Uint8Array(await file.arrayBuffer()),
      filename: file.name || 'reference.wav',
      mediaType: file.type || 'audio/wav',
    });
    return Response.json({ voiceId, voices: await listVoices() }, { status: 201 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
