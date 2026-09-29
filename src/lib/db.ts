import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type Role = 'user' | 'assistant';

export interface Conversation {
  id: string;
  title: string;
  persona: string;
  persona_id: string | null;
  /** Side chats hang off a main conversation and share its memory. */
  parent_id: string | null;
  summary: string | null;
  summary_upto_seq: number;
  default_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  seq: number;
  role: Role;
  content: string;
  reasoning: string | null;
  model_id: string | null;
  provider: string | null;
  created_at: string;
}

export interface Persona {
  id: string;
  name: string;
  emoji: string;
  avatar: string | null;
  tagline: string;
  instructions: string;
  preferred_model: string | null;
  voice: string | null;
  voice_speed: number | null;
  voice_language: string | null;
  is_preset: number;
  created_at: string;
}

export type AttachmentKind = 'image' | 'file' | 'document' | 'spreadsheet' | 'audio';

export interface Attachment {
  id: string;
  conversation_id: string | null;
  message_id: string | null;
  kind: AttachmentKind;
  /** `upload` comes from the user, `generated` is an artifact Hydra produced. */
  origin: 'upload' | 'generated';
  name: string;
  media_type: string;
  size: number;
  path: string;
  created_at: string;
}

export interface Memory {
  id: string;
  scope: 'global' | 'conversation';
  conversation_id: string | null;
  content: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  conversation_id: string | null;
  title: string;
  details: string | null;
  /** ISO timestamp at which the reminder becomes due. */
  due_at: string;
  status: 'pending' | 'done' | 'cancelled';
  created_at: string;
}

const DB_PATH = resolve(process.env.HYDRA_DB_PATH ?? './data/hydra.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      avatar TEXT,
      tagline TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL,
      preferred_model TEXT,
      voice TEXT,
      voice_speed REAL,
      voice_language TEXT,
      is_preset INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      persona TEXT NOT NULL DEFAULT '',
      persona_id TEXT REFERENCES personas(id) ON DELETE SET NULL,
      parent_id TEXT,
      summary TEXT,
      summary_upto_seq INTEGER NOT NULL DEFAULT 0,
      default_model TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning TEXT,
      model_id TEXT,
      provider TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_conversation_seq
      ON messages(conversation_id, seq);

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS memories_scope ON memories(scope, conversation_id);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      message_id TEXT,
      kind TEXT NOT NULL,
      origin TEXT NOT NULL DEFAULT 'upload',
      name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS attachments_message ON attachments(message_id);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      title TEXT NOT NULL,
      details TEXT,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reminders_due ON reminders(status, due_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  migrate(db);
  db.pragma('foreign_keys = ON');
  seedPersonas(db);
  return db;
}

/** Adds columns introduced after a database was first created. */
function migrate(database: Database.Database): void {
  const additions: [table: string, column: string, definition: string][] = [
    ['personas', 'avatar', 'TEXT'],
    ['personas', 'voice', 'TEXT'],
    ['personas', 'voice_speed', 'REAL'],
    ['personas', 'voice_language', 'TEXT'],
    ['conversations', 'parent_id', 'TEXT'],
    ['attachments', 'origin', "TEXT NOT NULL DEFAULT 'upload'"],
  ];

  for (const [table, column, definition] of additions) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (columns.some((c) => c.name === column)) continue;
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export const now = () => new Date().toISOString();

export function listConversations(): Conversation[] {
  return getDb()
    .prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
    .all() as Conversation[];
}

export function getConversation(id: string): Conversation | undefined {
  return getDb()
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as Conversation | undefined;
}

export function createConversation(input: {
  id: string;
  title?: string;
  persona?: string;
  personaId?: string | null;
  parentId?: string | null;
  defaultModel?: string | null;
}): Conversation {
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO conversations (id, title, persona, persona_id, parent_id, summary, summary_upto_seq, default_model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.title ?? 'Nouvelle conversation',
      input.persona ?? '',
      input.personaId ?? null,
      input.parentId ?? null,
      input.defaultModel ?? null,
      ts,
      ts,
    );
  return getConversation(input.id)!;
}

export function updateConversation(
  id: string,
  patch: Partial<
    Pick<
      Conversation,
      'title' | 'persona' | 'persona_id' | 'parent_id' | 'summary' | 'summary_upto_seq' | 'default_model'
    >
  >,
): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  getDb()
    .prepare(`UPDATE conversations SET ${sets}, updated_at = ? WHERE id = ?`)
    .run(...fields.map((f) => patch[f] ?? null), now(), id);
}

/** A side chat shares the memory of its parent, so memory lookups follow the chain. */
export function memoryRootId(conversationId: string): string {
  let current = getConversation(conversationId);
  const seen = new Set<string>();
  while (current?.parent_id && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = getConversation(current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? conversationId;
}

export function listSideChats(parentId: string): Conversation[] {
  return getDb()
    .prepare('SELECT * FROM conversations WHERE parent_id = ? ORDER BY created_at ASC')
    .all(parentId) as Conversation[];
}

export function deleteConversation(id: string): void {
  for (const child of listSideChats(id)) deleteConversation(child.id);
  getDb().prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
  getDb().prepare('DELETE FROM memories WHERE conversation_id = ?').run(id);
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

export function listMessages(conversationId: string): Message[] {
  return getDb()
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY seq ASC')
    .all(conversationId) as Message[];
}

export function nextSeq(conversationId: string): number {
  const row = getDb()
    .prepare('SELECT COALESCE(MAX(seq), 0) AS max FROM messages WHERE conversation_id = ?')
    .get(conversationId) as { max: number };
  return row.max + 1;
}

export function insertMessage(input: {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  reasoning?: string | null;
  modelId?: string | null;
  provider?: string | null;
}): Message {
  const seq = nextSeq(input.conversationId);
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO messages (id, conversation_id, seq, role, content, reasoning, model_id, provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.conversationId,
      seq,
      input.role,
      input.content,
      input.reasoning ?? null,
      input.modelId ?? null,
      input.provider ?? null,
      ts,
    );
  getDb().prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(ts, input.conversationId);
  return getDb().prepare('SELECT * FROM messages WHERE id = ?').get(input.id) as Message;
}

export function deleteMessagesFrom(conversationId: string, seq: number): void {
  getDb()
    .prepare('DELETE FROM messages WHERE conversation_id = ? AND seq >= ?')
    .run(conversationId, seq);
}

export function listMemories(conversationId: string | null): Memory[] {
  return getDb()
    .prepare(
      `SELECT * FROM memories
       WHERE scope = 'global' OR (scope = 'conversation' AND conversation_id = ?)
       ORDER BY created_at ASC`,
    )
    .all(conversationId) as Memory[];
}

export function insertMemory(input: {
  id: string;
  scope: 'global' | 'conversation';
  conversationId: string | null;
  content: string;
}): Memory {
  getDb()
    .prepare(
      `INSERT INTO memories (id, scope, conversation_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.id, input.scope, input.conversationId, input.content, now());
  return getDb().prepare('SELECT * FROM memories WHERE id = ?').get(input.id) as Memory;
}

export function deleteMemory(id: string): void {
  getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
}

export function listReminders(status?: Reminder['status']): Reminder[] {
  const sql = status
    ? 'SELECT * FROM reminders WHERE status = ? ORDER BY due_at ASC'
    : 'SELECT * FROM reminders ORDER BY due_at ASC';
  const stmt = getDb().prepare(sql);
  return (status ? stmt.all(status) : stmt.all()) as Reminder[];
}

export function insertReminder(input: {
  id: string;
  conversationId: string | null;
  title: string;
  details?: string | null;
  dueAt: string;
}): Reminder {
  getDb()
    .prepare(
      `INSERT INTO reminders (id, conversation_id, title, details, due_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(input.id, input.conversationId, input.title, input.details ?? null, input.dueAt, now());
  return getDb().prepare('SELECT * FROM reminders WHERE id = ?').get(input.id) as Reminder;
}

export function setReminderStatus(id: string, status: Reminder['status']): void {
  getDb().prepare('UPDATE reminders SET status = ? WHERE id = ?').run(status, id);
}

export function deleteReminder(id: string): void {
  getDb().prepare('DELETE FROM reminders WHERE id = ?').run(id);
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .run(key, value);
}

const PRESET_PERSONAS: Omit<
  Persona,
  'created_at' | 'is_preset' | 'voice_speed' | 'voice_language' | 'emoji'
>[] = [
  {
    id: 'preset-hydra',
    avatar: 'preset-hydra',
    name: 'Hydra',
    tagline: 'Assistant généraliste, direct et concret',
    instructions:
      "Tu es Hydra, un assistant direct, concret et sans flagornerie. Tu vas droit au but, tu donnes des réponses actionnables et tu dis clairement quand tu ne sais pas. Tu réponds dans la langue de l'utilisateur.",
    preferred_model: null,
    voice: 'eve',
  },
  {
    id: 'preset-ingenieur',
    avatar: 'preset-ingenieur',
    name: 'Ingénieur',
    tagline: 'Code, architecture, debug',
    instructions:
      "Tu es un ingénieur logiciel senior. Tu donnes du code complet et exécutable, tu expliques les compromis d'architecture en deux phrases maximum et tu signales les pièges de sécurité et de performance. Pas de code pseudo ni de placeholders.",
    preferred_model: null,
    voice: 'rex',
  },
  {
    id: 'preset-analyste',
    avatar: 'preset-analyste',
    name: 'Analyste',
    tagline: 'Recherche, synthèse, chiffres',
    instructions:
      "Tu es un analyste rigoureux. Tu structures tes réponses en points clés, tu distingues toujours les faits vérifiés des hypothèses, tu cites tes sources quand tu en as et tu quantifies dès que possible.",
    preferred_model: null,
    voice: 'sal',
  },
  {
    id: 'preset-plume',
    avatar: 'preset-plume',
    name: 'Plume',
    tagline: 'Écriture, style, storytelling',
    instructions:
      "Tu es un auteur et éditeur. Tu écris avec un style vivant, des phrases courtes et des images concrètes. Tu proposes toujours une variante alternative du ton quand c'est pertinent, et tu évites les clichés et le remplissage.",
    preferred_model: null,
    voice: 'ara',
  },
  {
    id: 'preset-compagnon',
    avatar: 'preset-compagnon',
    name: 'Compagnon',
    tagline: 'Conversation libre, ton décontracté',
    instructions:
      "Tu es un compagnon de conversation curieux et chaleureux. Tu tutoies, tu gardes un ton décontracté et tu relances avec de vraies questions. Tu te souviens des détails personnels partagés et tu y reviens naturellement, sans jamais faire semblant de te souvenir de ce que tu ignores.",
    preferred_model: null,
    voice: 'ara',
  },
  {
    id: 'preset-conteur',
    avatar: 'preset-conteur',
    name: 'Conteur',
    tagline: 'Narration immersive, rythme et images',
    instructions:
      "Tu es un conteur. Tu racontes des histoires vivantes avec un rythme marqué, des détails sensoriels et des fins qui surprennent. Tu adaptes la longueur à la demande et tu proposes de continuer l'histoire.",
    preferred_model: null,
    voice: 'leo',
  },
  {
    id: 'preset-coach',
    avatar: 'preset-coach',
    name: 'Coach',
    tagline: 'Motivation, discipline, tough love',
    instructions:
      "Tu es un coach intense. Tu pousses l'utilisateur à agir, tu refuses les excuses, tu donnes des objectifs mesurables et des échéances. Ton ton est énergique mais jamais humiliant.",
    preferred_model: null,
    voice: 'leo',
  },
  {
    id: 'preset-zen',
    avatar: 'preset-zen',
    name: 'Zen',
    tagline: 'Méditation, respiration, calme',
    instructions:
      'Tu guides des méditations et des exercices de respiration. Tu parles lentement, avec des phrases courtes et des silences marqués par [pause]. Tu ne donnes jamais de conseil médical.',
    preferred_model: null,
    voice: 'sal',
  },
  {
    id: 'preset-tuteur',
    avatar: 'preset-tuteur',
    name: 'Tuteur',
    tagline: 'Devoirs, explications pas à pas',
    instructions:
      "Tu es un tuteur patient. Tu expliques pas à pas, tu vérifies la compréhension par des questions et tu ne donnes jamais la réponse finale avant d'avoir fait réfléchir l'utilisateur au moins une fois.",
    preferred_model: null,
    voice: 'eve',
  },
  {
    id: 'preset-avocat-du-diable',
    avatar: 'preset-avocat-du-diable',
    name: "Avocat du diable",
    tagline: 'Contradiction argumentée',
    instructions:
      "Tu prends systématiquement le contre-pied des affirmations de l'utilisateur pour tester leur solidité. Tu argumentes avec des faits, tu concèdes quand l'argument adverse est meilleur et tu termines par la position la plus défendable.",
    preferred_model: null,
    voice: 'rex',
  },
];

function seedPersonas(database: Database.Database): void {
  const insert = database.prepare(
    `INSERT OR IGNORE INTO personas (id, name, avatar, tagline, instructions, preferred_model, voice, is_preset, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  );
  const backfill = database.prepare('UPDATE personas SET avatar = ? WHERE id = ? AND avatar IS NULL');
  const ts = now();
  for (const p of PRESET_PERSONAS) {
    insert.run(p.id, p.name, p.avatar, p.tagline, p.instructions, p.preferred_model, p.voice, ts);
    backfill.run(p.avatar, p.id);
  }
}

export function listPersonas(): Persona[] {
  return getDb()
    .prepare('SELECT * FROM personas ORDER BY is_preset DESC, created_at ASC')
    .all() as Persona[];
}

export function getPersona(id: string): Persona | undefined {
  return getDb().prepare('SELECT * FROM personas WHERE id = ?').get(id) as Persona | undefined;
}

export function createPersona(input: {
  id: string;
  name: string;
  avatar?: string | null;
  tagline?: string;
  instructions: string;
  preferredModel?: string | null;
  voice?: string | null;
  voiceSpeed?: number | null;
  voiceLanguage?: string | null;
}): Persona {
  getDb()
    .prepare(
      `INSERT INTO personas (id, name, avatar, tagline, instructions, preferred_model, voice, voice_speed, voice_language, is_preset, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      input.id,
      input.name,
      input.avatar ?? null,
      input.tagline ?? '',
      input.instructions,
      input.preferredModel ?? null,
      input.voice ?? null,
      input.voiceSpeed ?? null,
      input.voiceLanguage ?? null,
      now(),
    );
  return getPersona(input.id)!;
}

export function updatePersona(
  id: string,
  patch: Partial<
    Pick<
      Persona,
      | 'name'
      | 'avatar'
      | 'tagline'
      | 'instructions'
      | 'preferred_model'
      | 'voice'
      | 'voice_speed'
      | 'voice_language'
    >
  >,
): void {
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  getDb()
    .prepare(`UPDATE personas SET ${sets} WHERE id = ?`)
    .run(...fields.map((f) => patch[f] ?? null), id);
}

export function insertAttachment(input: {
  id: string;
  conversationId: string | null;
  kind: AttachmentKind;
  origin?: 'upload' | 'generated';
  name: string;
  mediaType: string;
  size: number;
  path: string;
}): Attachment {
  getDb()
    .prepare(
      `INSERT INTO attachments (id, conversation_id, message_id, kind, origin, name, media_type, size, path, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.id,
      input.conversationId,
      input.kind,
      input.origin ?? 'upload',
      input.name,
      input.mediaType,
      input.size,
      input.path,
      now(),
    );
  return getAttachment(input.id)!;
}

export function getAttachment(id: string): Attachment | undefined {
  return getDb().prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment | undefined;
}

export function attachToMessage(ids: string[], messageId: string, conversationId: string): void {
  const stmt = getDb().prepare(
    'UPDATE attachments SET message_id = ?, conversation_id = ? WHERE id = ?',
  );
  for (const id of ids) stmt.run(messageId, conversationId, id);
}

export function listAttachments(messageIds: string[]): Attachment[] {
  if (messageIds.length === 0) return [];
  const placeholders = messageIds.map(() => '?').join(',');
  return getDb()
    .prepare(`SELECT * FROM attachments WHERE message_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...messageIds) as Attachment[];
}

export function listLibrary(limit = 200): Attachment[] {
  return getDb()
    .prepare('SELECT * FROM attachments ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Attachment[];
}

export function deletePersona(id: string): void {
  getDb().prepare('DELETE FROM personas WHERE id = ? AND is_preset = 0').run(id);
}
