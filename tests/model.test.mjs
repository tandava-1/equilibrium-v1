import test from "node:test";
import assert from "node:assert/strict";
import {
  metrics,
  rate,
  weekRecords,
  parseNumber,
  bool,
  localDate,
} from "../dist/model.js";
test("rates exclude missing answers without treating them as no", () => {
  assert.deepEqual(rate([{ x: true }, { x: false }, { x: null }, {}], "x"), {
    yes: 1,
    total: 2,
    missing: 2,
    percent: 50,
  });
  assert.equal(rate([], "x").percent, null);
});
test("zero recovery is counted; unknown recovery is not", () => {
  const m = metrics([
    { recoveryMinutes: 0 },
    { recoveryMinutes: 20 },
    { recoveryMinutes: null },
    {},
  ]);
  assert.equal(m.recovery, 10);
  assert.equal(m.recoveryCount, 2);
});
test("repair excludes irrelevant and unknown relevance", () => {
  const m = metrics([
    { repairRelevant: true, repaired: true },
    { repairRelevant: true, repaired: null },
    { repairRelevant: false, repaired: false },
    { repaired: true },
  ]);
  assert.deepEqual(m.repair, { yes: 1, total: 1, missing: 1, percent: 100 });
});
test("rolling week includes exactly seven local dates and excludes future", () => {
  const r = ["2026-10-08", "2026-10-09", "2026-10-15", "2026-10-16"].map(
    (occurredAt) => ({ occurredAt }),
  );
  assert.deepEqual(
    weekRecords(r, new Date(2026, 9, 15)).map((r) => r.occurredAt),
    ["2026-10-09", "2026-10-15"],
  );
});
test("numeric input distinguishes empty from zero and rejects invalid values", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("0"), 0);
  assert.throws(() => parseNumber("-1"));
  assert.throws(() => parseNumber("11", 10));
  assert.throws(() => parseNumber("abc"));
});
test("unknown boolean stays unknown", () => {
  assert.equal(bool("unknown"), null);
  assert.equal(bool("yes"), true);
  assert.equal(bool("no"), false);
});
test("dates preserve local calendar day", () =>
  assert.equal(localDate(new Date(2026, 0, 1, 0, 1)), "2026-01-01"));
