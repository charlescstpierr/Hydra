import { generateText, isStepCount } from 'ai';
import { nanoid } from 'nanoid';
import {
  claimRoutine,
  dueReminders,
  finishRoutineRun,
  insertActivity,
  insertRoutineRun,
  listRoutines,
  markReminderNotified,
  routineSchedule,
} from './agent-store';
import { isDue } from './schedule';
import { buildTools } from './tools';
import { createConversation, getConversation, getPersona, insertMessage, now } from './db';
import { DEFAULT_PERSONA, personaPrompt } from './context';
import { defaultModelId, resolveModel, utilityModelId } from './models';

export async function deliverDueReminders(at = new Date()): Promise<number> {
  let sent = 0;
  for (const reminder of dueReminders(at)) {
    if (!reminder.conversation_id || !getConversation(reminder.conversation_id)) {
      markReminderNotified(reminder.id);
      continue;
    }
    insertMessage({
      id: nanoid(),
      conversationId: reminder.conversation_id,
      role: 'assistant',
      content: `Rappel : ${reminder.title}${reminder.details ? `\n${reminder.details}` : ''}`,
    });
    insertActivity({
      conversationId: reminder.conversation_id,
      kind: 'reminder',
      name: reminder.title,
      detail: reminder.due_at,
    });
    markReminderNotified(reminder.id);
    sent += 1;
  }
  return sent;
}

export async function runDueRoutines(at = new Date()): Promise<{ id: string; status: string }[]> {
  const outcomes: { id: string; status: string }[] = [];
  for (const routine of listRoutines()) {
    if (!routine.enabled) continue;
    const schedule = routineSchedule(routine);
    if (!schedule || !isDue(schedule, routine.last_run_at, at)) continue;
    const stamp = now();
    if (!claimRoutine(routine.id, routine.last_run_at, stamp)) continue;

    const persona = getPersona(routine.persona_id);
    const conversation = createConversation({
      id: nanoid(),
      title: `Routine · ${routine.name}`,
      persona: persona ? personaPrompt(persona) : DEFAULT_PERSONA,
      personaId: routine.persona_id,
      defaultModel: utilityModelId() ?? defaultModelId(),
    });
    const run = insertRoutineRun({ id: nanoid(), routineId: routine.id, conversationId: conversation.id });
    insertMessage({
      id: nanoid(),
      conversationId: conversation.id,
      role: 'user',
      content: routine.instructions,
    });

    const modelId = utilityModelId() ?? defaultModelId();
    if (!modelId) {
      insertMessage({
        id: nanoid(),
        conversationId: conversation.id,
        role: 'assistant',
        content: 'Routine enregistrée. Aucun modèle n’est configuré pour l’exécuter.',
      });
      finishRoutineRun(run.id, 'skipped', 'Aucun modèle configuré');
      outcomes.push({ id: routine.id, status: 'skipped' });
      continue;
    }

    try {
      const result = await generateText({
        model: resolveModel(modelId),
        instructions: persona ? personaPrompt(persona) : DEFAULT_PERSONA,
        prompt: routine.instructions,
        tools: buildTools({
          conversationId: conversation.id,
          web: true,
          images: false,
        }),
        stopWhen: isStepCount(4),
      });
      insertMessage({
        id: nanoid(),
        conversationId: conversation.id,
        role: 'assistant',
        content: result.text,
        modelId,
      });
      finishRoutineRun(run.id, 'succeeded', result.text.slice(0, 500));
      insertActivity({
        conversationId: conversation.id,
        kind: 'routine',
        name: routine.name,
        detail: result.text.slice(0, 280),
      });
      outcomes.push({ id: routine.id, status: 'succeeded' });
    } catch (error) {
      const message = (error as Error).message;
      insertMessage({
        id: nanoid(),
        conversationId: conversation.id,
        role: 'assistant',
        content: `La routine a échoué. ${message}`,
      });
      finishRoutineRun(run.id, 'failed', message);
      outcomes.push({ id: routine.id, status: 'failed' });
    }
  }
  return outcomes;
}
