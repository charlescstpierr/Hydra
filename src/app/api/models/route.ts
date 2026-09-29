import { defaultModelId, listModels, PROVIDER_LABELS, providerAvailable, utilityModelId, type ProviderId } from '@/lib/models';
import { imageGenerationAvailable, webSearchAvailable } from '@/lib/tools';
import { voiceAvailable, voiceCloningAvailable } from '@/lib/voice';

export const dynamic = 'force-dynamic';

export async function GET() {
  const providers = (Object.keys(PROVIDER_LABELS) as ProviderId[]).map((id) => ({
    id,
    label: PROVIDER_LABELS[id],
    available: providerAvailable(id),
  }));

  return Response.json({
    models: listModels(),
    providers,
    defaultModel: defaultModelId(),
    utilityModel: utilityModelId(),
    capabilities: {
      webSearch: webSearchAvailable(),
      imageGeneration: imageGenerationAvailable(),
      voice: voiceAvailable(),
      voiceCloning: voiceCloningAvailable(),
    },
  });
}
