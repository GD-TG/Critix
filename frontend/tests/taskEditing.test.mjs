import assert from "node:assert/strict";
import test from "node:test";
import {
  changeTaskStatus,
  rescheduleOverdueTasks,
} from "../src/taskEditing.ts";

const task = {
  id: "a",
  name: "API",
  duration_minutes: 60,
  allocation_percent: 100,
  status: "done",
  assignee_id: null,
  not_before: null,
  actual_start: "2026-09-21T09:00:00+05:00",
  actual_finish: "2026-09-21T10:00:00+05:00",
};

test("reopening a completed task clears only incompatible actual dates", () => {
  for (const status of ["in_progress", "blocked"]) {
    const result = changeTaskStatus(task, status);
    assert.equal(result.actual_start, task.actual_start);
    assert.equal(result.actual_finish, null);
  }
  const planned = changeTaskStatus(task, "todo");
  assert.equal(planned.actual_start, null);
  assert.equal(planned.actual_finish, null);
  assert.equal(task.status, "done");
  assert.equal(
    changeTaskStatus(task, "done").actual_finish,
    task.actual_finish,
  );
});

test("rescheduling preserves the UTC instant regardless of project offset", () => {
  const pending = changeTaskStatus(task, "todo");
  const analysis = {
    tasks: [{ id: "a", finish: "2026-09-21T10:00:00+05:00" }],
  };
  const now = new Date("2026-09-26T17:00:12+05:00");
  const [result] = rescheduleOverdueTasks([pending], analysis, now);
  assert.equal(result.not_before, "2026-09-26T12:01:00.000Z");
  assert.ok(new Date(result.not_before) >= now);
  assert.equal(pending.not_before, null);
});

test("rescheduling preserves completed and started tasks and future constraints", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const started = changeTaskStatus(task, "in_progress");
  const future = {
    ...changeTaskStatus(task, "todo"),
    not_before: "2026-10-01T12:00:00Z",
  };
  const analysis = {
    tasks: [{ id: "a", finish: "2026-09-21T10:00:00+05:00" }],
  };
  assert.equal(rescheduleOverdueTasks([task], analysis, now)[0], task);
  assert.equal(rescheduleOverdueTasks([started], analysis, now)[0], started);
  assert.equal(
    rescheduleOverdueTasks([future], analysis, now)[0].not_before,
    future.not_before,
  );
  const onTime = { tasks: [{ id: "a", finish: "2026-10-01T12:00:00Z" }] };
  assert.equal(rescheduleOverdueTasks([future], onTime, now)[0], future);
});
