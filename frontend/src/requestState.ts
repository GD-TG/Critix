import type { Project } from "./types";

export type Snapshot<T> = { id: string; version: number; draft: T };

// A generation changes even when the user switches A -> B -> A.
export function createRequestGate() {
  let dependencies: readonly unknown[] = [];
  let generation = 0;
  let request = 0;
  return {
    update(next: readonly unknown[]) {
      if (
        next.length !== dependencies.length ||
        next.some((v, i) => !Object.is(v, dependencies[i]))
      ) {
        dependencies = [...next];
        generation++;
      }
    },
    invalidate() {
      generation++;
    },
    watch() {
      const capturedGeneration = generation;
      return () => generation === capturedGeneration;
    },
    capture() {
      const capturedGeneration = generation;
      const capturedRequest = ++request;
      return () =>
        generation === capturedGeneration && request === capturedRequest;
    },
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

export function isCurrentSnapshot<T>(
  captured: Snapshot<T>,
  current: Snapshot<T> | null,
): boolean {
  return (
    current !== null &&
    captured.id === current.id &&
    captured.version === current.version &&
    captured.draft === current.draft
  );
}

export function computeProjectDiff(local: Project, server: Project): string[] {
  const diffs: string[] = [];

  if (local.name !== server.name) {
    diffs.push(
      `Название: на сервере «${server.name}», в черновике «${local.name}»`,
    );
  }
  if (local.deadline !== server.deadline) {
    diffs.push(
      `Дедлайн: на сервере ${server.deadline ?? "не задан"}, в черновике ${local.deadline ?? "не задан"}`,
    );
  }
  if (local.start !== server.start) {
    diffs.push(
      `Старт проекта: на сервере ${server.start}, в черновике ${local.start}`,
    );
  }
  if (local.timezone !== server.timezone)
    diffs.push("Часовой пояс проекта различается");
  if (canonical(local.calendar) !== canonical(server.calendar))
    diffs.push("Рабочий календарь проекта различается");
  if (canonical(local.baseline ?? null) !== canonical(server.baseline ?? null))
    diffs.push("Базовый план различается");
  const people = (p: Project) =>
    [...(p.assignees || [])].sort((a, b) => a.id.localeCompare(b.id));
  if (canonical(people(local)) !== canonical(people(server))) {
    diffs.push(
      "Исполнители, их навыки или индивидуальные календари различаются",
    );
  }

  const serverTasks = new Map((server.tasks || []).map((t) => [t.id, t]));
  const localTasks = new Map((local.tasks || []).map((t) => [t.id, t]));

  const addedLocally: string[] = [];
  const removedLocally: string[] = [];
  const modifiedTasks: string[] = [];

  for (const [id, t] of localTasks) {
    const st = serverTasks.get(id);
    if (!st) {
      addedLocally.push(t.name);
    } else {
      if (canonical(st) !== canonical(t)) {
        modifiedTasks.push(t.name);
      }
    }
  }

  for (const [id, st] of serverTasks) {
    if (!localTasks.has(id)) {
      removedLocally.push(st.name);
    }
  }

  if (addedLocally.length > 0) {
    diffs.push(`Новые задачи в черновике: ${addedLocally.join(", ")}`);
  }
  if (removedLocally.length > 0) {
    diffs.push(
      `Удалены в черновике (есть на сервере): ${removedLocally.join(", ")}`,
    );
  }
  if (modifiedTasks.length > 0) {
    diffs.push(`Задачи с разными параметрами: ${modifiedTasks.join(", ")}`);
  }

  const localDeps = local.dependencies || [];
  const serverDeps = server.dependencies || [];
  const dependencies = (items: typeof localDeps) => items.map(canonical).sort();
  if (
    canonical(dependencies(localDeps)) !== canonical(dependencies(serverDeps))
  ) {
    diffs.push(
      `Связи между задачами различаются (состав, тип или задержка): на сервере ${serverDeps.length}, в черновике ${localDeps.length}`,
    );
  }

  return diffs;
}
