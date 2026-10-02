import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

export function workspaceRoot(): string {
  return resolve(/*turbopackIgnore: true*/ process.env.HYDRA_WORKSPACE_DIR ?? './data/workspace');
}

export function resolveInside(root: string, userPath: string): string | null {
  if (userPath.includes('\0')) return null;
  const base = resolve(root);
  const target = resolve(base, userPath);
  const rel = relative(base, target);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return target;
}

export function ensureWorkspace(root = workspaceRoot()): string {
  mkdirSync(root, { recursive: true });
  return root;
}

export function listWorkspace(userPath = '.', root = workspaceRoot()): { name: string; kind: 'file' | 'dir'; size: number }[] {
  const dir = resolveInside(root, userPath);
  if (!dir) throw new Error('Chemin hors de l’ordinateur partagé');
  ensureWorkspace(root);
  return readdirSync(dir, { withFileTypes: true }).map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? 'dir' : 'file',
    size: entry.isFile() ? statSync(resolve(dir, entry.name)).size : 0,
  }));
}

export function readWorkspace(userPath: string, root = workspaceRoot()): string {
  const file = resolveInside(root, userPath);
  if (!file) throw new Error('Chemin hors de l’ordinateur partagé');
  const info = statSync(file);
  if (!info.isFile()) throw new Error('Ce chemin n’est pas un fichier');
  if (info.size > 200_000) throw new Error('Fichier trop volumineux');
  return readFileSync(file, 'utf8');
}

export function writeWorkspace(userPath: string, content: string, root = workspaceRoot()): { path: string; bytes: number } {
  const file = resolveInside(root, userPath);
  if (!file) throw new Error('Chemin hors de l’ordinateur partagé');
  if (content.length > 500_000) throw new Error('Contenu trop volumineux');
  ensureWorkspace(root);
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, content);
  return { path: userPath, bytes: Buffer.byteLength(content) };
}

export function deleteWorkspace(userPath: string, root = workspaceRoot()): { path: string } {
  const file = resolveInside(root, userPath);
  if (!file || file === resolve(root)) throw new Error('Chemin hors de l’ordinateur partagé');
  rmSync(file, { recursive: true, force: false });
  return { path: userPath };
}
