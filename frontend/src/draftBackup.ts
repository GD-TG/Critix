import type { Project } from "./types.ts";

export type DraftBackup = {draft: Project; baseVersion: number | null; timestamp: number};
export const backupKey = (id: string) => `critix_draft_backup_${id}`;

export function readBackup(storage: Pick<Storage, "getItem">, id: string): DraftBackup | null {
  const raw = storage.getItem(backupKey(id));
  if (!raw) return null;
  const value = JSON.parse(raw);
  const p = value?.draft;
  if (!p || typeof p.name !== "string" || !Array.isArray(p.tasks) || !Array.isArray(p.assignees) || !Array.isArray(p.dependencies) || typeof p.timezone !== "string")
    throw new Error("Сохранённая копия черновика повреждена");
  return {draft: p, baseVersion: Number.isInteger(value.baseVersion) ? value.baseVersion : null, timestamp: value.timestamp};
}

export function writeBackup(storage: Pick<Storage, "setItem">, id: string, version: number, draft: Project) {
  storage.setItem(backupKey(id), JSON.stringify({draft, baseVersion: version, timestamp: Date.now()}));
}

export function clearBackup(storage: Pick<Storage, "removeItem">, id: string) {
  try {
    storage.removeItem(backupKey(id));
  } catch {
    // Ignore storage errors
  }
}
