/** Commit only a successful result that still belongs to the current view. */
export async function applyCheckedScenario<T>(request: () => Promise<T>, isCurrent: () => boolean, accept: (result: T) => void): Promise<void> {
  const result = await request();
  if (isCurrent()) accept(result);
}
