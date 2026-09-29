import { isStepCount, streamText } from 'ai';
import { nanoid } from 'nanoid';
import { buildInstructions, buildModelMessages, DEFAULT_PERSONA } from '@/lib/context';
import {
  attachToMessage,
  deleteMessagesFrom,
  getConversation,
  getPersona,
  insertMessage,
  listAttachments,
  listMemories,
  listMessages,
  listReminders,
  memoryRootId,
  updateConversation,
  type Message,
} from '@/lib/db';
import { generateTitle, runPostTurnTasks } from '@/lib/memory';
import { parseModelId, resolveModel } from '@/lib/models';
import { buildTools } from '@/lib/tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface ChatRequest {
  conversationId: string;
  modelId: string;
  /** New user message. Omitted when regenerating the last assistant turn. */
  text?: string;
  attachmentIds?: string[];
  /** Drop every message from this sequence number on before generating again. */
  regenerateFromSeq?: number;
  webSearch?: boolean;
  imageGeneration?: boolean;
}

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const conversation = getConversation(body.conversationId);
  if (!conversation) return Response.json({ error: 'Conversation introuvable' }, { status: 404 });

  let model;
  try {
    model = resolveModel(body.modelId);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }

  if (body.regenerateFromSeq !== undefined) {
    deleteMessagesFrom(conversation.id, body.regenerateFromSeq);
  }

  let userMessage: Message | null = null;
  if (body.text?.trim()) {
    userMessage = insertMessage({
      id: nanoid(),
      conversationId: conversation.id,
      role: 'user',
      content: body.text.trim(),
    });
    if (body.attachmentIds?.length) {
      attachToMessage(body.attachmentIds, userMessage.id, conversation.id);
    }
  }

  const isFirstTurn = listMessages(conversation.id).length <= 1;
  updateConversation(conversation.id, { default_model: body.modelId });

  const history = listMessages(conversation.id);
  const persona = conversation.persona_id ? getPersona(conversation.persona_id) : undefined;
  const instructions = buildInstructions({
    conversation,
    personaInstructions: conversation.persona.trim() || persona?.instructions || DEFAULT_PERSONA,
    memories: listMemories(memoryRootId(conversation.id)),
    history,
    activeModelId: body.modelId,
    parent: conversation.parent_id ? getConversation(conversation.parent_id) : null,
    reminders: listReminders('pending'),
  });

  const tools = buildTools({
    conversationId: conversation.id,
    web: body.webSearch !== false,
    images: body.imageGeneration !== false,
  });

  const result = streamText({
    model,
    instructions,
    messages: await buildModelMessages(
      history,
      listAttachments(history.map((m) => m.id)),
    ),
    temperature: Number(process.env.TEMPERATURE ?? 0.7),
    tools,
    stopWhen: isStepCount(6),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      let text = '';
      let reasoning = '';

      if (userMessage) send('user-message', { message: userMessage });

      try {
        for await (const part of result.stream) {
          switch (part.type) {
            case 'text-delta':
              text += part.text;
              send('text', { delta: part.text });
              break;
            case 'reasoning-delta':
              reasoning += part.text;
              send('reasoning', { delta: part.text });
              break;
            case 'tool-call':
              send('tool', { name: part.toolName, input: part.input });
              break;
            case 'tool-result':
              send('tool-result', { name: part.toolName, output: part.output });
              break;
            case 'error':
              throw part.error instanceof Error ? part.error : new Error(String(part.error));
          }
        }
      } catch (error) {
        send('error', { message: (error as Error).message });
        controller.close();
        return;
      }

      const { provider } = parseModelId(body.modelId);
      const assistantMessage = insertMessage({
        id: nanoid(),
        conversationId: conversation.id,
        role: 'assistant',
        content: text,
        reasoning: reasoning || null,
        modelId: body.modelId,
        provider,
      });

      send('done', { message: assistantMessage });

      try {
        if (isFirstTurn && userMessage) await generateTitle(conversation.id, userMessage.content);
        await runPostTurnTasks(conversation.id);
        send('refresh', { conversation: getConversation(conversation.id) });
      } catch {
        // Background memory work must never break a completed answer.
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
