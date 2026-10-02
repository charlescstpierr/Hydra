import { nanoid } from 'nanoid';
import {
  createConversation,
  createPersona,
  getConversation,
  getDb,
  getPersona,
  getSetting,
  insertMessage,
  listConversations,
  listPersonas,
  now,
  setSetting,
  type Persona,
} from './db';
import { parseReviewRules, type ReviewRule } from './review-rules';
import { parseSchedule, type Schedule } from './schedule';

export interface Skill {
  id: string;
  slug: string;
  name: string;
  instructions: string;
  created_at: string;
}

export interface Routine {
  id: string;
  persona_id: string;
  name: string;
  instructions: string;
  schedule: string;
  enabled: number;
  last_run_at: string | null;
  created_at: string;
}

export interface RoutineRun {
  id: string;
  routine_id: string;
  status: 'running' | 'succeeded' | 'failed' | 'skipped';
  summary: string | null;
  conversation_id: string | null;
  started_at: string;
  finished_at: string | null;
}

export type ApprovalStatus = 'pending' | 'running' | 'approved' | 'rejected' | 'failed';

export interface Approval {
  id: string;
  conversation_id: string;
  persona_id: string | null;
  tool: string;
  input_json: string;
  status: ApprovalStatus;
  result_json: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface Activity {
  id: string;
  conversation_id: string;
  message_id: string | null;
  kind: 'tool' | 'approval' | 'routine' | 'handoff' | 'reminder';
  name: string;
  detail: string;
  created_at: string;
}

export interface Reaction {
  message_id: string;
  emoji: string;
  created_at: string;
}

export interface SearchHit {
  messageId: string;
  conversationId: string;
  title: string;
  excerpt: string;
  createdAt: string;
}

const REVIEW_KEY = 'auto_review';

export function listSkills(): Skill[] {
  return getDb().prepare('SELECT * FROM skills ORDER BY name ASC').all() as Skill[];
}

export function getSkillBySlug(slug: string): Skill | undefined {
  return getDb().prepare('SELECT * FROM skills WHERE slug = ?').get(slug) as Skill | undefined;
}

export function createSkill(input: { id: string; slug: string; name: string; instructions: string }): Skill {
  getDb()
    .prepare('INSERT INTO skills (id, slug, name, instructions, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(input.id, input.slug, input.name, input.instructions, now());
  return getDb().prepare('SELECT * FROM skills WHERE id = ?').get(input.id) as Skill;
}

export function updateSkill(id: string, patch: Partial<Pick<Skill, 'slug' | 'name' | 'instructions'>>): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  getDb()
    .prepare(`UPDATE skills SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`)
    .run(...fields.map((field) => patch[field]), id);
}

export function deleteSkill(id: string): void {
  getDb().prepare('DELETE FROM skills WHERE id = ?').run(id);
}

export function listRoutines(personaId?: string): Routine[] {
  if (personaId) {
    return getDb()
      .prepare('SELECT * FROM routines WHERE persona_id = ? ORDER BY created_at ASC')
      .all(personaId) as Routine[];
  }
  return getDb().prepare('SELECT * FROM routines ORDER BY created_at ASC').all() as Routine[];
}

export function getRoutine(id: string): Routine | undefined {
  return getDb().prepare('SELECT * FROM routines WHERE id = ?').get(id) as Routine | undefined;
}

export function routineSchedule(routine: Routine): Schedule | null {
  try {
    return parseSchedule(JSON.parse(routine.schedule));
  } catch {
    return null;
  }
}

export function createRoutine(input: {
  id: string;
  personaId: string;
  name: string;
  instructions: string;
  schedule: Schedule;
}): Routine {
  getDb()
    .prepare(
      `INSERT INTO routines (id, persona_id, name, instructions, schedule, enabled, last_run_at, created_at)
       VALUES (?, ?, ?, ?, ?, 1, NULL, ?)`,
    )
    .run(input.id, input.personaId, input.name, input.instructions, JSON.stringify(input.schedule), now());
  return getRoutine(input.id)!;
}

export function updateRoutine(
  id: string,
  patch: { name?: string; instructions?: string; schedule?: Schedule; enabled?: boolean },
): void {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    values.push(patch.name);
  }
  if (patch.instructions !== undefined) {
    sets.push('instructions = ?');
    values.push(patch.instructions);
  }
  if (patch.schedule !== undefined) {
    sets.push('schedule = ?');
    values.push(JSON.stringify(patch.schedule));
  }
  if (patch.enabled !== undefined) {
    sets.push('enabled = ?');
    values.push(patch.enabled ? 1 : 0);
  }
  if (sets.length === 0) return;
  getDb().prepare(`UPDATE routines SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
}

export function deleteRoutine(id: string): void {
  getDb().prepare('DELETE FROM routines WHERE id = ?').run(id);
}

export function claimRoutine(id: string, expectedLastRun: string | null, stamp: string): boolean {
  const result = getDb()
    .prepare(
      `UPDATE routines SET last_run_at = ?
       WHERE id = ? AND enabled = 1 AND ((? IS NULL AND last_run_at IS NULL) OR last_run_at = ?)`,
    )
    .run(stamp, id, expectedLastRun, expectedLastRun);
  return result.changes === 1;
}

export function releaseRoutineClaim(id: string, previous: string | null): void {
  getDb().prepare('UPDATE routines SET last_run_at = ? WHERE id = ?').run(previous, id);
}

export function insertRoutineRun(input: {
  id: string;
  routineId: string;
  conversationId: string | null;
}): RoutineRun {
  getDb()
    .prepare(
      `INSERT INTO routine_runs (id, routine_id, status, summary, conversation_id, started_at, finished_at)
       VALUES (?, ?, 'running', NULL, ?, ?, NULL)`,
    )
    .run(input.id, input.routineId, input.conversationId, now());
  return getDb().prepare('SELECT * FROM routine_runs WHERE id = ?').get(input.id) as RoutineRun;
}

export function finishRoutineRun(id: string, status: RoutineRun['status'], summary: string): void {
  getDb()
    .prepare('UPDATE routine_runs SET status = ?, summary = ?, finished_at = ? WHERE id = ?')
    .run(status, summary, now(), id);
}

export function listRoutineRuns(routineId: string, limit = 20): RoutineRun[] {
  return getDb()
    .prepare('SELECT * FROM routine_runs WHERE routine_id = ? ORDER BY started_at DESC LIMIT ?')
    .all(routineId, limit) as RoutineRun[];
}

export function createApproval(input: {
  id: string;
  conversationId: string;
  personaId: string | null;
  tool: string;
  input: unknown;
}): Approval {
  getDb()
    .prepare(
      `INSERT INTO approvals (id, conversation_id, persona_id, tool, input_json, status, result_json, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, NULL)`,
    )
    .run(input.id, input.conversationId, input.personaId, input.tool, JSON.stringify(input.input), now());
  return getApproval(input.id)!;
}

export function getApproval(id: string): Approval | undefined {
  return getDb().prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Approval | undefined;
}

export function listApprovals(conversationId?: string, status?: ApprovalStatus): Approval[] {
  const clauses: string[] = [];
  const values: string[] = [];
  if (conversationId) {
    clauses.push('conversation_id = ?');
    values.push(conversationId);
  }
  if (status) {
    clauses.push('status = ?');
    values.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return getDb()
    .prepare(`SELECT * FROM approvals ${where} ORDER BY created_at DESC`)
    .all(...values) as Approval[];
}

export function claimApproval(id: string): { approval: Approval | undefined; claimed: boolean } {
  const result = getDb()
    .prepare(`UPDATE approvals SET status = 'running' WHERE id = ? AND status IN ('pending', 'failed')`)
    .run(id);
  return { approval: getApproval(id), claimed: result.changes === 1 };
}

export function settleApproval(
  id: string,
  from: ApprovalStatus[],
  status: 'approved' | 'rejected' | 'failed',
  result: unknown,
): Approval | undefined {
  const marks = from.map(() => '?').join(', ');
  getDb()
    .prepare(`UPDATE approvals SET status = ?, result_json = ?, resolved_at = ? WHERE id = ? AND status IN (${marks})`)
    .run(status, JSON.stringify(result), now(), id, ...from);
  return getApproval(id);
}

export function insertActivity(input: {
  conversationId: string;
  messageId?: string | null;
  kind: Activity['kind'];
  name: string;
  detail: string;
}): Activity {
  const id = nanoid();
  getDb()
    .prepare(
      `INSERT INTO activities (id, conversation_id, message_id, kind, name, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.conversationId, input.messageId ?? null, input.kind, input.name, input.detail, now());
  return getDb().prepare('SELECT * FROM activities WHERE id = ?').get(id) as Activity;
}

export function listActivities(conversationId: string): Activity[] {
  return getDb()
    .prepare('SELECT * FROM activities WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId) as Activity[];
}

export function listReactions(messageIds: string[]): Reaction[] {
  if (messageIds.length === 0) return [];
  const marks = messageIds.map(() => '?').join(',');
  return getDb()
    .prepare(`SELECT * FROM reactions WHERE message_id IN (${marks})`)
    .all(...messageIds) as Reaction[];
}

export function toggleReaction(messageId: string, emoji: string): Reaction[] {
  const existing = getDb()
    .prepare('SELECT 1 FROM reactions WHERE message_id = ? AND emoji = ?')
    .get(messageId, emoji);
  if (existing) {
    getDb().prepare('DELETE FROM reactions WHERE message_id = ? AND emoji = ?').run(messageId, emoji);
  } else {
    getDb()
      .prepare('INSERT INTO reactions (message_id, emoji, created_at) VALUES (?, ?, ?)')
      .run(messageId, emoji, now());
  }
  return listReactions([messageId]);
}

export function searchMessages(query: string, limit = 20): SearchHit[] {
  const needle = query.trim();
  if (needle.length < 2) return [];
  const escaped = needle.replace(/[\\%_]/g, (char) => `\\${char}`);
  const rows = getDb()
    .prepare(
      `SELECT m.id AS messageId, m.conversation_id AS conversationId, m.content, m.created_at AS createdAt, c.title
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.content LIKE ? ESCAPE '\\'
       ORDER BY m.created_at DESC LIMIT ?`,
    )
    .all(`%${escaped}%`, limit) as {
    messageId: string;
    conversationId: string;
    content: string;
    createdAt: string;
    title: string;
  }[];
  return rows.map((row) => {
    const index = row.content.toLowerCase().indexOf(needle.toLowerCase());
    const start = Math.max(0, index - 40);
    return {
      messageId: row.messageId,
      conversationId: row.conversationId,
      title: row.title,
      excerpt: row.content.slice(start, start + 140),
      createdAt: row.createdAt,
    };
  });
}

export function loadReviewRules(): ReviewRule[] {
  const raw = getSetting(REVIEW_KEY);
  if (!raw) return [];
  try {
    return parseReviewRules(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveReviewRules(rules: ReviewRule[]): ReviewRule[] {
  const clean = parseReviewRules(rules);
  setSetting(REVIEW_KEY, JSON.stringify(clean));
  return clean;
}

export function duplicatePersona(id: string): Persona | undefined {
  const source = getPersona(id);
  if (!source) return undefined;
  return createPersona({
    id: nanoid(),
    name: `${source.name} copie`,
    avatar: source.avatar,
    tagline: source.tagline,
    instructions: source.instructions,
    greeting: source.greeting,
    tone: source.tone,
    preferredModel: source.preferred_model,
    voice: source.voice,
    voiceSpeed: source.voice_speed,
    voiceLanguage: source.voice_language,
  });
}

export function publicPersona(persona: Persona) {
  return {
    name: persona.name,
    tagline: persona.tagline,
    instructions: persona.instructions,
    greeting: persona.greeting,
    tone: persona.tone,
    preferredModel: persona.preferred_model,
    voice: persona.voice,
    voiceSpeed: persona.voice_speed,
    voiceLanguage: persona.voice_language,
    avatar: persona.avatar,
  };
}

export function forgetMemories(conversationId: string, query: string): { deleted: number } {
  const needle = query.trim();
  if (needle.length < 2) return { deleted: 0 };
  const result = getDb()
    .prepare(
      `DELETE FROM memories
       WHERE content LIKE ? ESCAPE '\\'
         AND (scope = 'global' OR conversation_id = ?)`,
    )
    .run(`%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`, conversationId);
  return { deleted: result.changes };
}

export function handoffToPersona(input: {
  sourceConversationId: string;
  personaId: string;
  note: string;
}): { conversationId: string; personaName: string } {
  const persona = getPersona(input.personaId);
  if (!persona) throw new Error('Bot introuvable');
  const source = getConversation(input.sourceConversationId);
  const existing = listConversations().find((item) => item.persona_id === persona.id && item.parent_id === null);
  const target =
    existing ??
    createConversation({
      id: nanoid(),
      title: `Relais de ${source?.title ?? 'Hydra'}`,
      persona: persona.instructions,
      personaId: persona.id,
    });
  insertMessage({
    id: nanoid(),
    conversationId: target.id,
    role: 'user',
    content: `Relais depuis « ${source?.title ?? 'une conversation'} » :\n${input.note}`,
  });
  insertActivity({
    conversationId: input.sourceConversationId,
    kind: 'handoff',
    name: persona.name,
    detail: input.note.slice(0, 280),
  });
  return { conversationId: target.id, personaName: persona.name };
}

export function findPersonaByMention(token: string): Persona | undefined {
  const needle = token.trim().toLowerCase();
  return listPersonas().find((persona) => persona.name.toLowerCase() === needle || persona.id === token);
}

export function dueReminders(at: Date) {
  return getDb()
    .prepare(
      `SELECT * FROM reminders
       WHERE status = 'pending' AND notified_at IS NULL AND due_at <= ?
       ORDER BY due_at ASC`,
    )
    .all(at.toISOString()) as {
    id: string;
    conversation_id: string | null;
    title: string;
    details: string | null;
    due_at: string;
  }[];
}

export function markReminderNotified(id: string): void {
  getDb().prepare(`UPDATE reminders SET notified_at = ? WHERE id = ? AND notified_at IS NULL`).run(now(), id);
}
