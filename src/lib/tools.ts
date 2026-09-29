import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { generateImage, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { insertReminder } from './db';
import { attachmentUrl, storeFile } from './files';
import { providerAvailable } from './models';
import { synthesize, voiceAvailable } from './voice';

export const webSearchAvailable = () => Boolean(process.env.TAVILY_API_KEY);
export const imageGenerationAvailable = () =>
  providerAvailable('xai') || providerAvailable('openai');

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

const webSearch = tool({
  description:
    "Recherche sur le web en temps réel. À utiliser dès que la question porte sur l'actualité, des prix, des versions logicielles, ou tout fait postérieur à l'entraînement du modèle.",
  inputSchema: z.object({
    query: z.string().describe('La requête de recherche, formulée comme sur un moteur de recherche.'),
    topic: z.enum(['general', 'news']).default('general'),
  }),
  execute: async ({ query, topic }) => {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        topic,
        max_results: 6,
        search_depth: 'basic',
        include_answer: 'basic',
      }),
    });

    if (!response.ok) {
      return { error: `Recherche impossible (HTTP ${response.status})` };
    }

    const data = (await response.json()) as { answer?: string; results?: TavilyResult[] };
    return {
      answer: data.answer ?? null,
      results: (data.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content.slice(0, 1200),
        publishedDate: r.published_date ?? null,
      })),
    };
  },
});

function imageModel() {
  if (providerAvailable('xai')) {
    return createXai({ apiKey: process.env.XAI_API_KEY }).image(
      process.env.IMAGE_MODEL ?? 'grok-imagine-image',
    );
  }
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).image(
    process.env.IMAGE_MODEL ?? 'gpt-image-1',
  );
}

function createImageTool(conversationId: string) {
  return tool({
    description:
      "Génère une image à partir d'une description. À utiliser quand l'utilisateur demande une image, une illustration, un logo ou un visuel.",
    inputSchema: z.object({
      prompt: z.string().describe("Description détaillée de l'image, en anglais de préférence."),
    }),
    execute: async ({ prompt }) => {
      const { images } = await generateImage({ model: imageModel(), prompt, n: 1 });
      const image = images[0];
      const attachment = await storeFile({
        data: image.uint8Array,
        name: 'image.png',
        mediaType: image.mediaType ?? 'image/png',
        conversationId,
        origin: 'generated',
      });
      return {
        url: attachmentUrl(attachment.id),
        instruction:
          "Affiche l'image dans ta réponse en markdown avec exactement cette URL, puis commente-la brièvement.",
      };
    },
  });
}

const ARTIFACT_FORMATS = {
  markdown: { extension: 'md', mediaType: 'text/markdown', kind: 'document' },
  html: { extension: 'html', mediaType: 'text/html', kind: 'document' },
  csv: { extension: 'csv', mediaType: 'text/csv', kind: 'spreadsheet' },
  text: { extension: 'txt', mediaType: 'text/plain', kind: 'document' },
} as const;

function createArtifactTool(conversationId: string) {
  return tool({
    description:
      "Crée un artefact persistant (document markdown, page HTML, feuille de calcul CSV, note texte) téléchargeable par l'utilisateur et conservé dans sa bibliothèque. À utiliser dès que l'utilisateur demande un document, un rapport, un tableau, un export ou un fichier.",
    inputSchema: z.object({
      title: z.string().describe("Titre court du document, sans extension."),
      format: z.enum(['markdown', 'html', 'csv', 'text']),
      content: z.string().describe('Contenu complet du fichier, prêt à être enregistré.'),
    }),
    execute: async ({ title, format, content }) => {
      const spec = ARTIFACT_FORMATS[format];
      const slug = title.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'artefact';
      const attachment = await storeFile({
        data: new TextEncoder().encode(content),
        name: `${slug}.${spec.extension}`,
        mediaType: spec.mediaType,
        kind: spec.kind,
        conversationId,
        origin: 'generated',
      });
      return {
        url: attachmentUrl(attachment.id),
        name: attachment.name,
        instruction:
          "Donne le lien de téléchargement en markdown avec exactement cette URL et résume le contenu en deux phrases.",
      };
    },
  });
}

function createPodcastTool(conversationId: string) {
  return tool({
    description:
      "Produit un fichier audio (podcast, résumé audio, méditation guidée) à partir d'un script écrit. À utiliser quand l'utilisateur demande un podcast ou une version audio.",
    inputSchema: z.object({
      title: z.string(),
      script: z.string().describe("Script complet à lire à voix haute. Les balises [pause], [laugh], [whisper] sont supportées."),
      voice: z.string().nullish().describe("Identifiant de voix, par exemple 'eve' ou 'rex'."),
      speed: z.number().min(0.7).max(1.5).nullish(),
      language: z.string().nullish(),
    }),
    execute: async ({ title, script, voice, speed, language }) => {
      const { data, mediaType } = await synthesize({ text: script, voice, speed, language });
      const slug = title.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'podcast';
      const attachment = await storeFile({
        data,
        name: `${slug}.mp3`,
        mediaType,
        kind: 'audio',
        conversationId,
        origin: 'generated',
      });
      return {
        url: attachmentUrl(attachment.id),
        instruction:
          "Donne le lien audio en markdown avec exactement cette URL et décris le contenu en une phrase.",
      };
    },
  });
}

function reminderTool(conversationId: string) {
  return tool({
    description:
      "Programme un rappel pour l'utilisateur à une date et heure précises. À utiliser quand l'utilisateur demande de lui rappeler quelque chose ou de planifier une tâche.",
    inputSchema: z.object({
      title: z.string(),
      details: z.string().nullish(),
      dueAt: z
        .string()
        .describe("Date et heure d'échéance au format ISO 8601, par exemple 2026-01-05T09:00:00Z."),
    }),
    execute: async ({ title, details, dueAt }) => {
      const parsed = new Date(dueAt);
      if (Number.isNaN(parsed.getTime())) {
        return { error: "Date invalide : utilise le format ISO 8601." };
      }
      const reminder = insertReminder({
        id: nanoid(),
        conversationId,
        title,
        details: details ?? null,
        dueAt: parsed.toISOString(),
      });
      return { id: reminder.id, dueAt: reminder.due_at, status: reminder.status };
    },
  });
}

export function buildTools(options: {
  conversationId: string;
  web: boolean;
  images: boolean;
}): ToolSet {
  const tools: ToolSet = {
    create_artifact: createArtifactTool(options.conversationId),
    set_reminder: reminderTool(options.conversationId),
  };
  if (options.web && webSearchAvailable()) tools.web_search = webSearch;
  if (options.images && imageGenerationAvailable()) {
    tools.create_image = createImageTool(options.conversationId);
  }
  if (voiceAvailable()) tools.create_podcast = createPodcastTool(options.conversationId);
  return tools;
}
