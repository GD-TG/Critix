import type { Analysis, Task } from "./types.ts";

export function changeTaskStatus(task: Task, status: Task["status"]): Task {
  return {
    ...task,
    status,
    actual_start: status === "todo" ? null : task.actual_start,
    actual_finish: status === "done" ? task.actual_finish : null,
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
