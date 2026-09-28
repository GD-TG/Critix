import test from "node:test";
import assert from "node:assert/strict";
import { isCurrentSnapshot, computeProjectDiff, createRequestGate } from "../src/requestState.ts";
import { api } from "../src/api.ts";

test("a late scenario reply cannot be accepted after parameter changes or project roundtrip", async () => {
  const gate = createRequestGate();
  const draft = {};
  gate.update(["A", 1, draft, 8, true]);
  const valid = gate.capture();
  let resolve;
  const reply = new Promise(r => { resolve = r; });
  let accepted = false;
  const request = reply.then(() => { if (valid()) accepted = true; });
  gate.update(["A", 1, draft, 16, true]);
  gate.update(["A", 1, draft, 8, true]);
  resolve();
  await request;
  assert.equal(accepted, false);
  const second = gate.capture();
  gate.update(["B", 1, draft, 8, true]);
  gate.update(["A", 1, draft, 8, true]);
  assert.equal(second(), false);
});

test("latest request wins; closing the view invalidates both replies and conflict actions", () => {
  const gate = createRequestGate();
  gate.update(["A", 1]);
  const conflict = gate.watch();
  const old = gate.capture();
  const current = gate.capture();
  assert.equal(old(), false);
  assert.equal(current(), true);
  assert.equal(conflict(), true);
  gate.invalidate();
  assert.equal(current(), false);
  assert.equal(conflict(), false);
});

test("new draft blocks baseline response but still allows acknowledging a save of the captured draft", () => {
  const old = { name: "before" };
  const current = { name: "after" };
  const baseline = createRequestGate();
  const saving = createRequestGate();
  baseline.update(["A", 1, old]);
  saving.update(["A", 1]);
  const baselineReply = baseline.capture();
  const savedReply = saving.capture();
  baseline.update(["A", 1, current]);
  saving.update(["A", 1]);
  assert.equal(baselineReply(), false);
  assert.equal(savedReply(), true);
  assert.equal(isCurrentSnapshot({id:"A",version:1,draft:old}, {id:"A",version:1,draft:current}), false);
});

test("conflict diff detects same-count dependency edits, calendars, resources and task allocation", () => {
  const server = {name:"P",start:"a",deadline:"b",timezone:"UTC",calendar:{week:{}},
    tasks:[{id:"1",name:"Task",allocation_percent:100}],
    assignees:[{id:"p",calendar:{exceptions:{}}}],
    dependencies:[{predecessor_id:"1",successor_id:"2",kind:"FS",lag_minutes:0,lag_mode:"working"}]};
  for (const mutate of [
    p => {p.dependencies[0].kind="SS";},
    p => {p.dependencies[0].lag_minutes=60;},
    p => {p.dependencies[0].lag_mode="elapsed";},
    p => {p.calendar.week["0"]=[];},
    p => {p.assignees[0].calendar.exceptions["2026-10-01"]=[];},
    p => {p.tasks[0].allocation_percent=50;},
  ]) {
    const local=structuredClone(server); mutate(local);
    assert.ok(computeProjectDiff(local,server).length>0);
  }
  assert.deepEqual(computeProjectDiff(structuredClone(server),server),[]);
});

test("a response belongs to its project, saved version and exact draft", () => {
  const draft = { name: "A" };
  const captured = { id: "one", version: 1, draft };
  assert.equal(isCurrentSnapshot(captured, { ...captured }), true);
  for (const current of [
    null,
    { ...captured, id: "two" },
    { ...captured, version: 2 },
    { ...captured, draft: { ...draft } },
  ]) {
    assert.equal(isCurrentSnapshot(captured, current), false);
  }
});

test("computeProjectDiff detects discrepancies between local draft and server project", () => {
  const server = {
    name: "Server Project",
    start: "2026-10-01",
    deadline: "2026-10-15",
    tasks: [
      { id: "t1", name: "Task 1", duration_minutes: 480, status: "todo" },
      { id: "t2", name: "Task 2", duration_minutes: 240, status: "in_progress" },
    ],
    dependencies: [],
  };

  const local = {
    name: "Local Project",
    start: "2026-10-01",
    deadline: "2026-10-20",
    tasks: [
      { id: "t1", name: "Task 1", duration_minutes: 960, status: "in_progress" },
      { id: "t3", name: "Task 3 (New)", duration_minutes: 120, status: "todo" },
    ],
    dependencies: [{ predecessor_id: "t1", successor_id: "t3", kind: "FS" }],
  };

  const diffs = computeProjectDiff(local, server);
  assert.equal(diffs.length, 6);
  assert.ok(diffs.some((d) => d.includes("Название")));
  assert.ok(diffs.some((d) => d.includes("Дедлайн")));
  assert.ok(diffs.some((d) => d.includes("Новые задачи в черновике: Task 3 (New)")));
  assert.ok(diffs.some((d) => d.includes("Удалены в черновике (есть на сервере): Task 2")));
  assert.ok(diffs.some((d) => d.includes("Задачи с разными параметрами: Task 1")));
  assert.ok(diffs.some((d) => d.includes("Связи между задачами")));
});

test("API timeout cancels a hung request and warns about uncertain save outcome", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      });
    await assert.rejects(api("/test", "PUT", {}, 5), /Запрос мог быть выполнен/);
    globalThis.fetch = async () =>
      new Response("<html>proxy error</html>", { status: 502 });
    await assert.rejects(api("/test"), /некорректный ответ/);
  } finally {
    globalThis.fetch = original;
  }
});
