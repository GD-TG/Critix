import assert from "node:assert/strict";
import test from "node:test";
import { fromDateInput, toDateInput } from "../src/dateInput.ts";

test("server UTC dates display and round-trip in the project zone", () => {
  assert.equal(
    toDateInput("2026-09-26T12:01:00Z", "Asia/Yekaterinburg"),
    "2026-09-26T17:01",
  );
  assert.equal(
    fromDateInput("2026-09-26T17:01", "Asia/Yekaterinburg"),
    "2026-09-26T12:01:00.000Z",
  );
  assert.equal(
    fromDateInput("2026-09-26T17:01", "Europe/Moscow"),
    "2026-09-26T14:01:00.000Z",
  );
});

test("DST offsets belong to the edited date, not the project start", () => {
  assert.equal(
    fromDateInput("2026-01-15T09:00", "Europe/Berlin"),
    "2026-01-15T08:00:00.000Z",
  );
  assert.equal(
    fromDateInput("2026-07-15T09:00", "Europe/Berlin"),
    "2026-07-15T07:00:00.000Z",
  );
  assert.throws(
    () => fromDateInput("2026-03-29T02:30", "Europe/Berlin"),
    RangeError,
  );
  assert.throws(
    () => fromDateInput("2026-10-25T02:30", "Europe/Berlin"),
    RangeError,
  );
});

test("fractional offsets and empty or invalid inputs", () => {
  assert.equal(
    fromDateInput("2026-09-26T09:00", "Asia/Kathmandu"),
    "2026-09-26T03:15:00.000Z",
  );
  assert.equal(fromDateInput("", "Asia/Yekaterinburg"), "");
  assert.equal(toDateInput("", "Asia/Yekaterinburg"), "");
  assert.throws(
    () => fromDateInput("2026-02-30T09:00", "Europe/Moscow"),
    RangeError,
  );
});
