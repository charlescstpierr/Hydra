import { execFile } from 'node:child_process';
import { statSync, writeFileSync } from 'node:fs';
import { getAttachment, getDb } from './db';
import { forgetMemories, handoffToPersona } from './agent-store';
import { deleteWorkspace, ensureWorkspace, listWorkspace, readWorkspace, writeWorkspace, workspaceRoot } from './workspace';

export const GATED_TOOLS = ['workspace_write', 'workspace_delete', 'workspace_shell', 'forget', 'update_artifact'] as const;

export function isGatedTool(name: string): boolean {
  return (GATED_TOOLS as readonly string[]).includes(name);
}

export interface ActionContext {
  conversationId: string;
}

function runShell(command: string): Promise<{ code: number | null; output: string }> {
  const cwd = ensureWorkspace();
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '/usr/bin',
    LANG: 'C.UTF-8',
    HOME: cwd,
    NODE_ENV: process.env.NODE_ENV ?? 'development',
  };
  return new Promise((resolvePromise) => {
    execFile(
      '/bin/sh',
      ['-c', command],
      { cwd, env, timeout: 15_000, maxBuffer: 20_000 },
      (error, stdout, stderr) => {
        const code = typeof error?.code === 'number' ? error.code : error ? 1 : 0;
        resolvePromise({ code, output: `${stdout}${stderr}`.slice(0, 20_000) });
      },
    );
  });
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') throw new Error('Arguments invalides');
  return input as Record<string, unknown>;
}

function textField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Champ ${key} manquant`);
  return value;
}

export async function executeAction(tool: string, input: unknown, ctx: ActionContext): Promise<unknown> {
  const record = asRecord(input);
  if (tool === 'workspace_list') {
    const path = typeof record.path === 'string' ? record.path : '.';
    return { root: workspaceRoot(), entries: listWorkspace(path) };
  }
  if (tool === 'workspace_read') {
    return { path: textField(record, 'path'), content: readWorkspace(textField(record, 'path')) };
  }
  if (tool === 'workspace_write') {
    return writeWorkspace(textField(record, 'path'), textField(record, 'content'));
  }
  if (tool === 'workspace_delete') {
    return deleteWorkspace(textField(record, 'path'));
  }
  if (tool === 'workspace_shell') {
    const command = textField(record, 'command');
    if (command.length > 4_000) throw new Error('Commande trop longue');
    return runShell(command);
  }
  if (tool === 'forget') {
    return forgetMemories(ctx.conversationId, textField(record, 'query'));
  }
  if (tool === 'update_artifact') {
    const attachment = getAttachment(textField(record, 'attachmentId'));
    if (!attachment || attachment.conversation_id !== ctx.conversationId) throw new Error('Artefact introuvable');
    if (attachment.origin !== 'generated') throw new Error('Seuls les artefacts générés se réécrivent');
    if (!attachment.media_type.startsWith('text/')) throw new Error('Artefact non textuel');
    const content = textField(record, 'content');
    writeFileSync(attachment.path, content);
    const size = statSync(attachment.path).size;
    getDb().prepare('UPDATE attachments SET size = ? WHERE id = ?').run(size, attachment.id);
    return { id: attachment.id, name: attachment.name, bytes: size };
  }
  if (tool === 'handoff') {
    return handoffToPersona({
      sourceConversationId: ctx.conversationId,
      personaId: textField(record, 'personaId'),
      note: textField(record, 'note'),
    });
  }
  throw new Error(`Action inconnue : ${tool}`);
}
