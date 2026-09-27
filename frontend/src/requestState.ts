export type Snapshot<T> = {id: string; version: number; draft: T};

export function isCurrentSnapshot<T>(captured: Snapshot<T>, current: Snapshot<T> | null): boolean {
  return current !== null && captured.id === current.id && captured.version === current.version && captured.draft === current.draft;
}
