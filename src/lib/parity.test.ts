import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = mkdtempSync(join(tmpdir(), 'hydra-parity-'));
process.env.HYDRA_DB_PATH = join(root, 'hydra.db');
process.env.HYDRA_WORKSPACE_DIR = join(root, 'workspace');

test('horaire intervalle, quotidien et hebdomadaire', async () => {
  const { isDue, parseSchedule } = await import('./schedule');
  const now = new Date('2026-10-02T15:30:00.000Z');
  assert.equal(parseSchedule({ kind: 'interval', everyMinutes: 0 }), null);
  const interval = parseSchedule({ kind: 'interval', everyMinutes: 30 });
  assert.ok(interval);
  assert.equal(isDue(interval!, null, now), true);
  assert.equal(isDue(interval!, '2026-10-02T15:10:00.000Z', now), false);
  assert.equal(isDue(interval!, '2026-10-02T14:00:00.000Z', now), true);

  const daily = parseSchedule({ kind: 'daily', hour: 15, minute: 0 });
  assert.ok(daily);
  assert.equal(isDue(daily!, null, now), true);
  assert.equal(isDue(daily!, '2026-10-02T15:00:00.000Z', now), false);
  assert.equal(isDue(daily!, '2026-10-01T15:00:00.000Z', now), true);

  const weekly = parseSchedule({ kind: 'weekly', weekday: 5, hour: 9, minute: 0 });
  assert.ok(weekly);
  assert.equal(isDue(weekly!, '2026-10-02T09:00:00.000Z', now), false);
});

test('mentions et règles d’auto-revue', async () => {
  const { slashTokens, atTokens } = await import('./mentions');
  const { decisionFor } = await import('./review-rules');
  assert.deepEqual(slashTokens('fais /veille puis /resume-hebdo'), ['veille', 'resume-hebdo']);
  assert.deepEqual(atTokens('passe à @Analyste'), ['Analyste']);
  const rules = [
    { id: 'a', effect: 'allow' as const, tool: 'workspace_shell' },
    { id: 'r', effect: 'require' as const, tool: 'workspace_*' },
  ];
  assert.equal(decisionFor('workspace_shell', rules, true), 'require');
  assert.equal(decisionFor('workspace_read', [], false), 'allow');
  assert.equal(decisionFor('workspace_write', [], true), 'require');
});

test('l’ordinateur refuse les chemins qui sortent du dossier', async () => {
  const { resolveInside, writeWorkspace, readWorkspace } = await import('./workspace');
  const base = process.env.HYDRA_WORKSPACE_DIR!;
  assert.equal(resolveInside(base, '../secret'), null);
  assert.equal(resolveInside(base, 'notes/../../secret'), null);
  writeWorkspace('notes/plan.md', 'bonjour');
  assert.equal(readWorkspace('notes/plan.md'), 'bonjour');
});

test('recherche, oubli, copie de bot, approbation unique, rappel unique, claim de routine', async () => {
  const db = await import('./db');
  const store = await import('./agent-store');
  const { resolveApproval } = await import('./approvals');
  const { deliverDueReminders } = await import('./routines');

  const persona = db.createPersona({
    id: 'bot-source',
    name: 'Analyste',
    instructions: 'Tu analyses.',
    tagline: 'chiffres',
  });
  const conversation = db.createConversation({ id: 'conv-1', title: 'Brief', personaId: persona.id });
  db.insertMessage({ id: 'msg-1', conversationId: conversation.id, role: 'user', content: 'Le prix du cuivre a monté' });
  db.insertMemory({ id: 'mem-1', scope: 'global', conversationId: null, content: 'Aime le café serré' });
  db.insertMemory({ id: 'mem-2', scope: 'conversation', conversationId: conversation.id, content: 'Projet cuivre' });

  const hits = store.searchMessages('cuivre');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.conversationId, conversation.id);
  assert.equal(store.searchMessages('%').length, 0);

  const forgotten = store.forgetMemories(conversation.id, 'café');
  assert.equal(forgotten.deleted, 1);
  assert.equal(db.listMemories(conversation.id).some((memory) => memory.content.includes('café')), false);
  assert.equal(db.listMemories(conversation.id).some((memory) => memory.content.includes('cuivre')), true);

  const copy = store.duplicatePersona(persona.id);
  assert.ok(copy);
  assert.notEqual(copy!.id, persona.id);
  assert.equal(copy!.instructions, persona.instructions);
  assert.equal(db.listConversations().filter((item) => item.persona_id === copy!.id).length, 0);

  const approval = store.createApproval({
    id: 'ap-1',
    conversationId: conversation.id,
    personaId: persona.id,
    tool: 'workspace_write',
    input: { path: 'preuve.txt', content: 'une fois' },
  });
  const first = await resolveApproval(approval.id, 'approve');
  assert.equal(first.status, 'approved');
  const written = readFileSync(join(process.env.HYDRA_WORKSPACE_DIR!, 'preuve.txt'), 'utf8');
  assert.equal(written, 'une fois');
  const second = await resolveApproval(approval.id, 'approve');
  assert.equal(second.result_json, first.result_json);
  assert.equal(second.resolved_at, first.resolved_at);

  db.insertReminder({
    id: 'rem-1',
    conversationId: conversation.id,
    title: 'Appeler Léa',
    dueAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(await deliverDueReminders(new Date('2026-10-02T00:00:00.000Z')), 1);
  assert.equal(await deliverDueReminders(new Date('2026-10-02T00:00:00.000Z')), 0);
  const texts = db.listMessages(conversation.id).map((message) => message.content);
  assert.equal(texts.filter((text) => text.includes('Appeler Léa')).length, 1);

  const { executeAction } = await import('./actions');
  const shell = (await executeAction('workspace_shell', { command: 'printf hi' }, { conversationId: conversation.id })) as {
    output: string;
    code: number | null;
  };
  assert.equal(shell.code, 0);
  assert.equal(shell.output, 'hi');

  const routine = store.createRoutine({
    id: 'rt-1',
    personaId: persona.id,
    name: 'Veille',
    instructions: 'Résume.',
    schedule: { kind: 'interval', everyMinutes: 1000 },
  });
  assert.equal(store.claimRoutine(routine.id, null, '2026-10-02T00:00:00.000Z'), true);
  assert.equal(store.claimRoutine(routine.id, null, '2026-10-02T00:01:00.000Z'), false);
});
