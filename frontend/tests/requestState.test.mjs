import test from "node:test";
import assert from "node:assert/strict";
import {isCurrentSnapshot} from "../src/requestState.ts";
import {api} from "../src/api.ts";

test("a response belongs to its project, saved version and exact draft", () => {
  const draft = {name: "A"};
  const captured = {id: "one", version: 1, draft};
  assert.equal(isCurrentSnapshot(captured, {...captured}), true);
  for (const current of [null, {...captured, id: "two"}, {...captured, version: 2}, {...captured, draft: {...draft}}]) {
    assert.equal(isCurrentSnapshot(captured, current), false);
  }
});

test("API timeout cancels a hung request and warns about uncertain save outcome", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
    await assert.rejects(api("/test", "PUT", {}, 5), /Запрос мог быть выполнен/);
    globalThis.fetch = async () => new Response("<html>proxy error</html>", {status: 502});
    await assert.rejects(api("/test"), /некорректный ответ/);
  } finally { globalThis.fetch = original; }
});
