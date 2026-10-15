import test from "node:test";
import assert from "node:assert/strict";
import {
  northStar,
  metrics,
  repairBreakdown,
  parseRoute,
  toHash,
  displayTitle,
  plural,
  migrateRecord,
  parseNumber,
} from "../dist/model.js";
import { extractIncidentStub } from "../dist/ai.js";
test("North Star excludes SOS and no-goal records from answered denominator", () =>
  assert.deepEqual(
    northStar([
      { responseGoal: "pause", goalMet: true },
      { responseGoal: "pause", goalMet: false },
      { goalMet: true },
      { responseGoal: "pause" },
      { kind: "sos", goalMet: true },
    ]),
    { total: 4, met: 1, notMet: 1, unknown: 1, noGoal: 1 },
  ));
test("median is robust to extreme recovery and preserves zero", () => {
  assert.equal(
    metrics([
      { recoveryMinutes: 5 },
      { recoveryMinutes: 10 },
      { recoveryMinutes: 1440 },
    ]).recoveryMedian,
    10,
  );
  assert.equal(metrics([{ recoveryMinutes: 0 }]).recoveryMedian, 0);
  assert.throws(() => parseNumber("1441", 1440));
});
test("repair missingness distinguishes relevance and outcome", () =>
  assert.deepEqual(
    repairBreakdown([
      { repairRelevant: false },
      {},
      { repairRelevant: true, repaired: true },
      { repairRelevant: true },
    ]),
    {
      relevant: 2,
      notRelevant: 1,
      relevanceUnknown: 1,
      repaired: 1,
      outcomeUnknown: 1,
    },
  ));
test("routes round trip including IDs and steps", () => {
  for (const r of [
    { page: "home" },
    { page: "history" },
    { page: "detail", id: "abc 123" },
    { page: "reflect", id: null, step: 3 },
    { page: "reflect", id: "abc", step: 6 },
    { page: "sos" },
    { page: "learn" },
    { page: "lesson", id: "pause" },
    { page: "progress" },
    { page: "privacy" },
  ])
    assert.deepEqual(parseRoute(toHash(r)), r);
  assert.deepEqual(parseRoute("#/wrong"), { page: "home" });
});
test("title and plural helpers are consistent", () => {
  assert.equal(
    displayTitle({ narrative: "A moment. Another sentence." }),
    "A moment",
  );
  assert.equal(plural(1, "episode"), "1 episode");
  assert.equal(plural(2, "episode"), "2 episodes");
});
test("migration preserves records and labels interpretations", () => {
  const r = migrateRecord({ id: "old", automaticThought: "They dislike me" });
  assert.equal(r.id, "old");
  assert.equal(r.provenance.automaticThought, "user_interpretation");
  assert.equal(r.schemaVersion, 2);
});
test("local extraction never invents intensity", () => {
  const r = extractIncidentStub(
    "I felt angry in the meeting. I thought they did not care. I asked for a break.",
  );
  assert.equal(r.fields.intensity, undefined);
  assert.equal(r.fields.emotion.provenance, "local_suggestion");
  assert.equal(r.fields.automaticThought.provenance, "user_interpretation");
  assert.equal(r.fields.response.provenance, "user_fact");
});
test("extraction uses explicit intensity and contextual recovery only", () => {
  assert.equal(
    extractIncidentStub("It was 8 out of 10. I calmed down after 20 minutes.")
      .fields.intensity.value,
    8,
  );
  assert.equal(
    extractIncidentStub("The meeting lasted 20 minutes.").fields
      .recoveryMinutes,
    undefined,
  );
});
test("linked SOS and expanded incident are not counted twice", async () => {
  const { weekRecords, localDate } = await import("../dist/model.js");
  const today = localDate();
  const w = weekRecords([
    { id: "s", kind: "sos", occurredAt: today },
    { id: "i", kind: "incident", linkedSOS: "s", occurredAt: today },
  ]);
  assert.equal(w.length, 1);
  assert.equal(w[0].id, "i");
});
