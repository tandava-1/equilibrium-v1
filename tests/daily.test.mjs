import test from "node:test";
import assert from "node:assert/strict";
import {
  splitTargets,
  sortReflection,
  matchTarget,
  splitLines,
  carryOver,
  dailyMessage,
  dueNotifications,
  defaultNotificationSettings,
  normalizeSettings,
  dayStatus,
  pruneSent,
  mergeSent,
  shiftDate,
  validateDays,
  mergeDays,
  reflectionReminderText,
} from "../dist/daily.js";
import { MESSAGES } from "../dist/messages.js";
import { parseRoute, toHash } from "../dist/model.js";

const values = (list) => list.map((p) => p.value);

test("spoken targets split on spoken separators and verb-led 'and'", () => {
  assert.deepEqual(
    values(
      splitTargets(
        "today I want to finish the quarterly report then call mum and book the dentist also a 20 minute walk",
      ),
    ),
    ["Finish the quarterly report", "Call mum", "Book the dentist", "A 20 minute walk"],
  );
});

test("'and' between non-task words does not split a target", () => {
  assert.deepEqual(
    values(splitTargets("My targets for today are research and write the spec")),
    ["Research and write the spec"],
  );
  assert.deepEqual(values(splitTargets("Email Sam, Priya and Lee about the launch")), [
    "Email Sam, Priya and Lee about the launch",
  ]);
  assert.deepEqual(values(splitTargets("plan next week's sprint")), [
    "Plan next week's sprint",
  ]);
});

test("typed lists, fillers and duplicates are handled", () => {
  assert.deepEqual(values(splitTargets("- Finish brief\n- Gym\n3. Read 20 pages\n- gym")), [
    "Finish brief",
    "Gym",
    "Read 20 pages",
  ]);
  assert.deepEqual(
    values(splitTargets("okay so first of all I need to review the PR next one go for a run that's it")),
    ["Review the PR", "Go for a run"],
  );
  assert.deepEqual(splitTargets("   "), []);
  assert.equal(splitTargets("Call mum").at(0).evidence, "Call mum");
});

test("lines added as written stay the user's words", () => {
  assert.deepEqual(splitLines("call mum\n\n- read 20 pages."), ["Call mum", "Read 20 pages"]);
});

const targets = [
  { id: "a", text: "Finish the quarterly report" },
  { id: "b", text: "Call mum" },
  { id: "c", text: "Book the dentist" },
];

test("evening speech sorts into learnings, next steps and target reviews", () => {
  const r = sortReflection(
    "today I learned that mornings are better for deep work my next step is to block nine to eleven tomorrow I finished the report but I didn't call mum",
    targets,
  );
  assert.deepEqual(
    r.map((p) => [p.kind, p.value, p.targetId]),
    [
      ["learning", "Mornings are better for deep work", undefined],
      ["nextStep", "Block nine to eleven", undefined],
      ["done", true, "a"],
      ["done", false, "b"],
    ],
  );
});

test("past-tense actions start a new clause in unpunctuated speech", () => {
  const r = sortReflection("my next step is to block nine to eleven tomorrow I called mum", targets);
  assert.deepEqual(
    r.map((p) => [p.kind, p.value, p.targetId]),
    [
      ["nextStep", "Block nine to eleven", undefined],
      ["done", true, "b"],
    ],
  );
});

test("unclear sentences stay unsorted instead of being guessed", () => {
  const r = sortReflection("It was a long day. I learnt to ask earlier.", targets);
  assert.deepEqual(
    r.map((p) => [p.kind, p.value]),
    [
      [null, "It was a long day"],
      ["learning", "Ask earlier"],
    ],
  );
  // A completion that matches no target is not attached to one.
  assert.equal(sortReflection("I finished a novel", targets)[0].kind, null);
});

test("target matching needs at least half of the target's words", () => {
  assert.equal(matchTarget("I emailed the report", targets)?.id, "a");
  assert.equal(matchTarget("I called mum", targets)?.id, "b");
  assert.equal(matchTarget("I wrote a poem", targets), null);
});

test("status counts keep unreviewed separate from not done", () => {
  assert.deepEqual(
    dayStatus({
      targets: [{ done: true }, { done: false }, { done: null }, {}],
      learnings: [{}],
      nextSteps: [],
    }),
    { targets: 4, done: 1, notDone: 1, unreviewed: 2, learnings: 1, nextSteps: 0 },
  );
  assert.deepEqual(dayStatus(undefined), {
    targets: 0,
    done: 0,
    notDone: 0,
    unreviewed: 0,
    learnings: 0,
    nextSteps: 0,
  });
});

test("carry-over offers next steps and explicit not-done targets, not unreviewed ones", () => {
  const days = {
    "2026-11-02": {
      date: "2026-11-02",
      targets: [
        { id: "1", text: "Draft pricing", done: false },
        { id: "2", text: "Call dentist", done: null },
        { id: "3", text: "Walk", done: true },
      ],
      learnings: [],
      nextSteps: [{ id: "4", text: "Share the outline" }],
    },
    "2026-11-04": {
      date: "2026-11-04",
      targets: [{ id: "5", text: "share the outline" }],
      learnings: [],
      nextSteps: [],
    },
  };
  assert.deepEqual(carryOver(days, "2026-11-04"), [
    { value: "Draft pricing", from: "Not done", date: "2026-11-02" },
  ]);
  assert.deepEqual(carryOver(days, "2026-11-20"), []);
});

test("daily messages visit every message once per cycle", () => {
  const seen = new Set();
  for (let i = 0; i < MESSAGES.length; i++)
    seen.add(dailyMessage(shiftDate("2026-11-04", i)).text);
  assert.equal(seen.size, MESSAGES.length);
  assert.equal(dailyMessage("2026-11-04"), dailyMessage("2026-11-04"));
  assert.notEqual(dailyMessage("2026-11-04"), dailyMessage("2026-11-05"));
});

const on = { ...defaultNotificationSettings(), enabled: true };
const at = (h, m = 0) => new Date(2026, 10, 4, h, m);
const date = "2026-11-04";
const emptyDay = { targets: [], learnings: [], nextSteps: [] };

test("notifications respect the master switch, time and once-per-day log", () => {
  assert.deepEqual(
    dueNotifications({ now: at(9), date, day: emptyDay, settings: defaultNotificationSettings() }),
    [],
  );
  assert.deepEqual(
    dueNotifications({ now: at(7, 59), date, day: emptyDay, settings: on }).map((n) => n.type),
    [],
  );
  assert.deepEqual(
    dueNotifications({ now: at(8), date, day: emptyDay, settings: on }).map((n) => n.type),
    ["quote"],
  );
  assert.deepEqual(
    dueNotifications({ now: at(8, 5), date, day: emptyDay, settings: on, sent: ["quote"] }),
    [],
  );
});

test("reminders fire only while their condition holds", () => {
  const withTarget = { ...emptyDay, targets: [{ id: "t", text: "Run" }] };
  assert.deepEqual(
    dueNotifications({ now: at(10, 30), date, day: emptyDay, settings: on, sent: ["quote"] }).map((n) => n.type),
    ["targets"],
  );
  assert.deepEqual(
    dueNotifications({ now: at(10, 30), date, day: withTarget, settings: on, sent: ["quote"] }),
    [],
  );
  const complete = {
    ...withTarget,
    learnings: [{ id: "l", text: "x" }],
    nextSteps: [{ id: "n", text: "y" }],
  };
  assert.deepEqual(
    dueNotifications({ now: at(21, 10), date, day: complete, settings: on, sent: ["quote", "targets"] }),
    [],
  );
  const due = dueNotifications({
    now: at(21, 10),
    date,
    day: { ...withTarget, learnings: [{ id: "l", text: "x" }] },
    settings: on,
    sent: ["quote", "targets"],
  });
  assert.deepEqual(due.map((n) => n.type), ["reflection"]);
  assert.equal(due[0].body, "Add a next step from today. One target is still unreviewed.");
});

test("missed notifications show late only within the late window", () => {
  assert.deepEqual(
    dueNotifications({ now: at(11), date, day: emptyDay, settings: on }).map((n) => n.type),
    ["quote", "targets"],
  );
  assert.deepEqual(
    dueNotifications({ now: at(13, 30), date, day: emptyDay, settings: on }).map((n) => n.type),
    [],
  );
});

test("reflection reminder names exactly what is missing", () => {
  assert.equal(
    reflectionReminderText({ learnings: 0, nextSteps: 0, unreviewed: 0 }),
    "Add a learning and a next step from today.",
  );
  assert.equal(
    reflectionReminderText({ learnings: 0, nextSteps: 2, unreviewed: 3 }),
    "Add a learning from today. 3 targets are still unreviewed.",
  );
});

test("settings normalise bad input and the sent log is pruned", () => {
  const s = normalizeSettings({ enabled: "yes", quote: { on: false, time: "25:00" }, sent: { bad: [], "2026-11-01": ["quote"] } });
  assert.equal(s.enabled, false);
  assert.deepEqual(s.quote, { on: false, time: "08:00" });
  assert.deepEqual(s.sent, { "2026-11-01": ["quote"] });
  assert.deepEqual(
    Object.keys(pruneSent({ "2026-10-01": [], "2026-11-01": [], "2026-11-04": [] }, "2026-11-04")),
    ["2026-11-01", "2026-11-04"],
  );
});

test("sent logs from two tabs merge without duplicates", () =>
  assert.deepEqual(mergeSent({ "2026-11-04": ["quote"] }, { "2026-11-04": ["quote", "targets"], "2026-11-03": ["quote"] }), {
    "2026-11-04": ["quote", "targets"],
    "2026-11-03": ["quote"],
  }));

test("dates shift across month and year boundaries", () => {
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
});

test("backup days validate and merge without overwriting", () => {
  const local = {
    "2026-11-03": { date: "2026-11-03", targets: [{ id: "a", text: "Mine", done: true }], learnings: [], nextSteps: [] },
  };
  const incoming = validateDays({
    "2026-11-03": {
      date: "2026-11-03",
      targets: [
        { id: "a", text: "Changed", done: false },
        { id: "b", text: "New" },
      ],
      learnings: [],
      nextSteps: [],
    },
    "2026-11-02": { date: "2026-11-02", targets: [], learnings: [{ id: "c", text: "L" }], nextSteps: [] },
  });
  const merged = mergeDays(local, incoming);
  assert.deepEqual(merged["2026-11-03"].targets.map((t) => [t.id, t.text]), [
    ["a", "Mine"],
    ["b", "New"],
  ]);
  assert.equal(merged["2026-11-02"].learnings.length, 1);
  assert.equal(local["2026-11-03"].targets.length, 1);
  assert.throws(() => validateDays({ "2026-11-03": { date: "2026-11-03", targets: [{ id: "a", text: "x", done: "yes" }], learnings: [], nextSteps: [] } }));
  assert.throws(() => validateDays([]));
  assert.deepEqual(validateDays(undefined), {});
});

test("today routes round trip with and without a date", () => {
  for (const r of [{ page: "today" }, { page: "today", date: "2026-11-03" }])
    assert.deepEqual(parseRoute(toHash(r)), r);
  assert.deepEqual(parseRoute("#/today/not-a-date"), { page: "today" });
});
