import test from "node:test";
import assert from "node:assert/strict";
import {tasksToCsv, parseCsvToTasks} from "../src/taskCsv.ts";

const task = {id: "a", name: 'Задача; с "кавычками"\nи переносом', priority: "high", duration_minutes: 60,
  assignee_id: "dev", status: "done", not_before: null, required_skills: ["A, B", "Python"], allocation_percent: 50,
  actual_start: "2026-09-21T09:00:00+05:00", actual_finish: "2026-09-21T10:00:00+05:00"};
const people = [{id: "dev", name: "Разработчик"}];
test("CSV roundtrip preserves minutes, actual dates, quotes and allocation", () => {
  assert.deepEqual(parseCsvToTasks(tasksToCsv([task]), people), [task]);
});
test("CSV rejects duplicate IDs, unknown assignees and missing actual dates", () => {
  assert.throws(() => parseCsvToTasks(tasksToCsv([task]), people, ["a"]), /уже существует/);
  assert.throws(() => parseCsvToTasks(tasksToCsv([task]), []), /исполнитель/);
  assert.throws(() => parseCsvToTasks(tasksToCsv([{...task, actual_start: null}]), people), /фактические даты/);
});
