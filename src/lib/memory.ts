import { generateText, Output } from 'ai';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  getConversation,
  insertMemory,
  listMemories,
  listMessages,
  memoryRootId,
  updateConversation,
  type Message,
} from './db';
import { WINDOW_SIZE } from './context';
import { resolveModel, utilityModelId } from './models';

const MEMORY_ENABLED = process.env.MEMORY_EXTRACTION !== 'off';

const transcript = (messages: Message[]) =>
  messages.map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content}`).join('\n\n');

/**
 * Extracts durable facts from the last exchange so that any model picked later in
 * the thread inherits the same knowledge about the user and the task.
 */
export async function extractMemories(conversationId: string): Promise<void> {
  if (!MEMORY_ENABLED) return;
  const utility = utilityModelId();
  if (!utility) return;

  const messages = listMessages(conversationId);
  const lastExchange = messages.slice(-4);
  if (lastExchange.length === 0) return;

  const root = memoryRootId(conversationId);
  const existing = listMemories(root).map((m) => m.content);

  const { output } = await generateText({
    model: resolveModel(utility),
    output: Output.object({
      schema: z.object({
        facts: z
          .array(
            z.object({
              content: z.string().describe('Le fait, formulé en une phrase courte et autonome.'),
              scope: z
                .enum(['global', 'conversation'])
                .describe(
                  "global = vrai pour l'utilisateur en général (préférences, contexte personnel, style attendu). conversation = spécifique au sujet en cours.",
                ),
            }),
          )
          .describe('Laisse vide si rien de durable ne mérite d\'être retenu.'),
      }),
    }),
    instructions: `Tu extrais la mémoire durable d'un assistant conversationnel.
Retiens uniquement ce qui restera utile dans plusieurs jours : identité, préférences, contraintes, décisions prises, conventions de travail, objectifs.
N'extrais jamais de banalités, de reformulations de la question, ni d'informations déjà connues.
Maximum 3 faits.`,
    prompt: `Faits déjà mémorisés :\n${existing.length ? existing.map((f) => `- ${f}`).join('\n') : '(aucun)'}

Dernier échange :
${transcript(lastExchange)}`,
  });

  for (const fact of output.facts) {
    const content = fact.content.trim();
    if (!content) continue;
    if (existing.some((e) => e.toLowerCase() === content.toLowerCase())) continue;
    insertMemory({
      id: nanoid(),
      scope: fact.scope,
      conversationId: fact.scope === 'conversation' ? root : null,
      content,
    });
  }
}

/**
 * Rolls messages that fell out of the context window into a running summary, so a
 * model joining mid-thread still sees the whole history.
 */
export async function maybeSummarize(conversationId: string): Promise<void> {
  const utility = utilityModelId();
  if (!utility) return;
  const conversation = getConversation(conversationId);
  if (!conversation) return;

  const messages = listMessages(conversationId);
  const overflow = messages.slice(0, Math.max(0, messages.length - WINDOW_SIZE));
  const pending = overflow.filter((m) => m.seq > conversation.summary_upto_seq);
  if (pending.length === 0) return;

  const { text } = await generateText({
    model: resolveModel(utility),
    instructions: `Tu maintiens le résumé continu d'une conversation.
Produis un résumé factuel et dense (max 250 mots) qui conserve : le but de l'utilisateur, les décisions prises, les contraintes, les éléments techniques précis (noms, chiffres, chemins) et les points restés ouverts.
Pas de formules d'introduction, pas de listes à puces vides de contenu.`,
    prompt: `Résumé actuel :\n${conversation.summary ?? '(aucun)'}

Nouveaux échanges à intégrer :
${transcript(pending)}

Renvoie le résumé mis à jour, complet et autonome.`,
  });

  updateConversation(conversationId, {
    summary: text.trim(),
    summary_upto_seq: pending[pending.length - 1].seq,
  });
}

export async function generateTitle(conversationId: string, firstMessage: string): Promise<void> {
  const utility = utilityModelId();
  if (!utility) return;
  const { text } = await generateText({
    model: resolveModel(utility),
    instructions:
      "Tu écris le titre d'une conversation : 3 à 6 mots, sans guillemets, sans ponctuation finale, dans la langue du message.",
    prompt: firstMessage.slice(0, 2000),
  });
  const title = text.trim().replace(/^["'«»]|["'«»]$/g, '');
  if (title) updateConversation(conversationId, { title: title.slice(0, 80) });
}

/** Background maintenance after an assistant turn; never breaks the chat on failure. */
export async function runPostTurnTasks(conversationId: string): Promise<void> {
  await Promise.allSettled([extractMemories(conversationId), maybeSummarize(conversationId)]);
}
