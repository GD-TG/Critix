import type { Analysis, Task } from "./types.ts";

/**
 * Предлагает значения по умолчанию для фактических дат при завершении задачи.
 * - Для вех (duration_minutes === 0) разрешены одинаковые start и finish.
 * - Не навязывает искусственный час к длительности задачи.
 * - Сохраняет досрочное завершение и введенные пользователем даты.
 */
export function proposeActualDates(
  task: Task,
  plannedStart?: string | null,
  plannedFinish?: string | null,
  now = new Date(),
): { actual_start: string; actual_finish: string } {
  const isMilestone = task.duration_minutes === 0;
  now.setSeconds(0, 0);
  const nowIso = now.toISOString();

  let start = task.actual_start || plannedStart || nowIso;
  let finish = task.actual_finish;

  if (!finish) {
    if (isMilestone) {
      finish = start;
    } else if (plannedFinish && new Date(plannedFinish).getTime() > new Date(start).getTime()) {
      finish = plannedFinish;
    } else {
      const durMs = Math.max(task.duration_minutes, 1) * 60000;
      finish = new Date(new Date(start).getTime() + durMs).toISOString();
    }
  }

  // Для вехи разрешено равенство (0 мин). Окончание не может быть раньше начала.
  if (isMilestone) {
    if (new Date(finish).getTime() < new Date(start).getTime()) {
      finish = start;
    }
  } else {
    // Для обычной задачи окончание должно быть строго позже начала
    if (new Date(finish).getTime() <= new Date(start).getTime()) {
      const durMs = Math.max(task.duration_minutes, 1) * 60000;
      finish = new Date(new Date(start).getTime() + durMs).toISOString();
    }
  }

  return { actual_start: start, actual_finish: finish };
}

export function changeTaskStatus(
  task: Task,
  status: Task["status"],
  plannedStart?: string,
  plannedFinish?: string,
): Task {
  if (status === "todo") {
    return {
      ...task,
      status,
      actual_start: null,
      actual_finish: null,
    };
  }

  if (status === "in_progress") {
    return {
      ...task,
      status,
      actual_start: task.actual_start || plannedStart || new Date().toISOString(),
      actual_finish: null,
    };
  }

  if (status === "blocked") {
    return {
      ...task,
      status,
      actual_finish: null,
    };
  }

  if (status === "done") {
    const proposed = proposeActualDates(task, plannedStart, plannedFinish);
    return {
      ...task,
      status,
      actual_start: proposed.actual_start,
      actual_finish: proposed.actual_finish,
    };
  }

  return {
    ...task,
    status,
  };
}

export function rescheduleOverdueTasks(
  tasks: Task[],
  analysis: Analysis,
  now: Date,
): Task[] {
  const schedule = new Map(analysis.tasks.map((row) => [row.id, row]));
  // Preserve the instant in UTC, rounded up to the engine's minute precision.
  const notBefore = new Date(
    Math.ceil(now.getTime() / 60000) * 60000,
  ).toISOString();
  return tasks.map((task) => {
    const row = schedule.get(task.id);
    // Actual starts are fixed by the engine; changing not_before cannot move them.
    if (
      task.status === "done" ||
      task.actual_start ||
      !row ||
      new Date(row.finish).getTime() >= now.getTime()
    )
      return task;
    return {
      ...task,
      not_before:
        task.not_before && new Date(task.not_before) > new Date(notBefore)
          ? task.not_before
          : notBefore,
    };
  });
}
