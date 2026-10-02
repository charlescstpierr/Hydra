import type { ModelMessage, UserContent } from 'ai';
import type { Skill } from './agent-store';
import type { Attachment, Conversation, Memory, Message, Persona, Reminder } from './db';
import { readAttachment } from './files';
import { modelLabel } from './models';

export const WINDOW_SIZE = Number(process.env.CONTEXT_WINDOW_MESSAGES ?? 30);

const COHERENCE_RULES = `Tu es une seule et même entité, quel que soit le modèle qui génère la réponse.
Les tours précédents de cette conversation ont pu être produits par des modèles différents (Grok, Claude, GPT, Gemini...).
Règles de cohérence, non négociables :
- Reprends le fil comme si tu avais écrit toi-même tous les tours précédents : même persona, même tutoiement/vouvoiement, même langue, même niveau de détail.
- Ne dis jamais "en tant que modèle X", ne compare pas les modèles et ne signale pas un changement de modèle, sauf si l'utilisateur pose explicitement la question.
- Respecte les engagements, décisions et conventions déjà pris dans la conversation et dans la mémoire persistante, même s'ils ne viennent pas de toi.
- Si la mémoire persistante contredit un tour ancien, la mémoire l'emporte.
- N'invente pas de souvenirs : ce que tu sais de l'utilisateur se limite à la mémoire persistante et à la conversation.`;

export const DEFAULT_PERSONA = `Tu es Hydra, un assistant direct, concret et sans flagornerie. Tu réponds dans la langue de l'utilisateur.`;

export function personaPrompt(persona: Persona): string {
  const parts = [`Tu es ${persona.name}.`];
  if (persona.tagline.trim()) parts.push(persona.tagline.trim());
  if (persona.instructions.trim()) parts.push(persona.instructions.trim());
  const tone = (persona.tone ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tone.length > 0) parts.push(`Ton : ${tone.join(', ')}.`);
  return parts.join('\n');
}

export function buildInstructions(input: {
  conversation: Conversation;
  personaInstructions: string;
  memories: Memory[];
  history: Message[];
  activeModelId: string;
  parent?: Conversation | null;
  reminders?: Reminder[];
  skills?: Skill[];
  peers?: Persona[];
}): string {
  const { conversation, personaInstructions, memories, history, activeModelId } = input;
  const sections: string[] = [personaInstructions.trim() || DEFAULT_PERSONA, COHERENCE_RULES];

  const globals = memories.filter((m) => m.scope === 'global');
  const locals = memories.filter((m) => m.scope === 'conversation');
  if (globals.length > 0) {
    sections.push(
      `Mémoire persistante sur l'utilisateur (valable pour toutes les conversations) :\n${globals
        .map((m) => `- ${m.content}`)
        .join('\n')}`,
    );
  }
  if (locals.length > 0) {
    sections.push(
      `Mémoire de cette conversation :\n${locals.map((m) => `- ${m.content}`).join('\n')}`,
    );
  }

  if (input.parent) {
    sections.push(
      `Cette discussion est un fil parallèle rattaché à la conversation « ${input.parent.title} ». Tu partages sa mémoire et ses décisions, mais tu restes concentré sur le sujet de ce fil.${
        input.parent.summary ? `\nContexte du fil principal :\n${input.parent.summary}` : ''
      }`,
    );
  }

  const reminders = (input.reminders ?? []).filter((r) => r.status === 'pending');
  if (reminders.length > 0) {
    sections.push(
      `Rappels en cours :\n${reminders
        .map((r) => `- ${r.due_at} : ${r.title}${r.details ? ` (${r.details})` : ''}`)
        .join('\n')}`,
    );
  }

  if (input.skills && input.skills.length > 0) {
    sections.push(
      `Compétences invoquées pour ce tour :\n${input.skills
        .map((skill) => `## ${skill.name} (/${skill.slug})\n${skill.instructions}`)
        .join('\n\n')}`,
    );
  }

  if (input.peers && input.peers.length > 0) {
    sections.push(
      `Autres bots disponibles pour un relais (outil handoff) :\n${input.peers
        .map((peer) => `- ${peer.name} (${peer.id}) : ${peer.tagline}`)
        .join('\n')}`,
    );
  }

  if (conversation.summary) {
    sections.push(
      `Résumé des échanges antérieurs (hors fenêtre de contexte) :\n${conversation.summary}`,
    );
  }

  const usedModels = [
    ...new Set(history.filter((m) => m.role === 'assistant' && m.model_id).map((m) => m.model_id!)),
  ];
  const others = usedModels.filter((id) => id !== activeModelId);
  if (others.length > 0) {
    sections.push(
      `Provenance : certains tours assistant ont été générés par ${others
        .map(modelLabel)
        .join(', ')}. Tu les assumes comme les tiens.`,
    );
  }

  sections.push(`Date et heure actuelles : ${new Date().toISOString()}.`);

  return sections.join('\n\n');
}

export async function buildModelMessages(
  history: Message[],
  attachments: Attachment[],
): Promise<ModelMessage[]> {
  const byMessage = new Map<string, Attachment[]>();
  for (const attachment of attachments) {
    if (!attachment.message_id) continue;
    const list = byMessage.get(attachment.message_id) ?? [];
    list.push(attachment);
    byMessage.set(attachment.message_id, list);
  }

  const window = history.slice(-WINDOW_SIZE);
  const messages: ModelMessage[] = [];

  for (const message of window) {
    if (message.role === 'assistant') {
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }

    const quoted = message.reply_to_id
      ? history.find((item) => item.id === message.reply_to_id)
      : undefined;
    const text = quoted
      ? `En réponse à : « ${quoted.content.slice(0, 500)} »\n\n${message.content}`
      : message.content;
    const files = byMessage.get(message.id) ?? [];
    if (files.length === 0) {
      messages.push({ role: 'user', content: text });
      continue;
    }

    const parts: Exclude<UserContent, string> = [{ type: 'text', text }];
    for (const file of files) {
      try {
        const data = await readAttachment(file);
        parts.push({
          type: 'file',
          data: data.toString('base64'),
          mediaType: file.media_type,
          filename: file.name,
        });
      } catch {
        parts.push({ type: 'text', text: `[pièce jointe illisible : ${file.name}]` });
      }
    }
    messages.push({ role: 'user', content: parts });
  }

  return messages;
}
