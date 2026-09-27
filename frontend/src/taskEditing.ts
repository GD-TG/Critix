import type { Analysis, Task } from "./types.ts";

export function changeTaskStatus(
  task: Task,
  status: Task["status"],
  plannedStart?: string,
  plannedFinish?: string,
): Task {
  let actual_start = status === "todo" ? null : task.actual_start;
  let actual_finish = status === "done" ? task.actual_finish : null;

  if (status === "in_progress" && !actual_start) {
    actual_start = plannedStart || new Date().toISOString();
  }

  if (status === "done") {
    const durationMinutes = Math.max(task.duration_minutes || 60, 60);
    if (!actual_start) {
      if (plannedStart) {
        actual_start = plannedStart;
      } else {
        const now = Date.now();
        actual_start = new Date(now - durationMinutes * 60000).toISOString();
      }
    }
    if (!actual_finish) {
      if (plannedFinish && new Date(plannedFinish) > new Date(actual_start)) {
        actual_finish = plannedFinish;
      } else {
        const startMs = new Date(actual_start).getTime();
        actual_finish = new Date(startMs + durationMinutes * 60000).toISOString();
      }
    }
    // Ensure actual_finish is strictly after actual_start for non-zero duration tasks
    if (actual_start && actual_finish && new Date(actual_finish) <= new Date(actual_start)) {
      const startMs = new Date(actual_start).getTime();
      actual_finish = new Date(startMs + durationMinutes * 60000).toISOString();
    }
  }

  return {
    ...task,
    status,
    actual_start,
    actual_finish,
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
