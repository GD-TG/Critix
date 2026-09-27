import test from "node:test";
import assert from "node:assert/strict";
import {readBackup, writeBackup} from "../src/draftBackup.ts";

test("backup roundtrip preserves base version and separates projects", () => {
  const data = new Map();
  const storage = {getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value)};
  const project = {name:"Draft", timezone:"UTC", tasks:[], assignees:[], dependencies:[]};
  writeBackup(storage, "one", 7, project);
  const backup = readBackup(storage, "one");
  assert.deepEqual(backup.draft, project);
  assert.equal(backup.baseVersion, 7);
  assert.equal(readBackup(storage, "two"), null);
  assert.throws(() => readBackup({getItem: () => '{"draft":null}'}, "bad"));
});
