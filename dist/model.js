export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function weekRecords(records, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 6);
  const linked = new Set(
    records
      .filter((r) => r.kind !== "sos" && r.linkedSOS)
      .map((r) => r.linkedSOS),
  );
  return records.filter((r) => {
    if (r.kind === "sos" && linked.has(r.id)) return false;
    const d = new Date(r.occurredAt + "T12:00:00");
    return d >= start && r.occurredAt <= localDate(now);
  });
}
export function rate(records, key) {
  const known = records.filter((r) => typeof r[key] === "boolean");
  const yes = known.filter((r) => r[key]).length;
  return {
    yes,
    total: known.length,
    missing: records.length - known.length,
    percent: known.length ? Math.round((yes / known.length) * 100) : null,
  };
}
export function metrics(records) {
  const recovery = records.filter(
    (r) =>
      typeof r.recoveryMinutes === "number" &&
      Number.isFinite(r.recoveryMinutes) &&
      r.recoveryMinutes >= 0,
  );
  const nums = recovery.map((r) => r.recoveryMinutes).sort((a, b) => a - b);
  return {
    recoveryMedian: nums.length
      ? (nums[Math.floor((nums.length - 1) / 2)] +
          nums[Math.floor(nums.length / 2)]) /
        2
      : null,
    recoveryRange: nums.length ? [nums[0], nums.at(-1)] : null,
    repairBreakdown: repairBreakdown(records),
    awareness: rate(records, "recognizedTrigger"),
    pause: rate(records, "pauseAttempted"),
    escalation: rate(records, "harmfulBehavior"),
    repair: rate(
      records.filter((r) => r.repairRelevant === true),
      "repaired",
    ),
    recovery: recovery.length
      ? Math.round(
          recovery.reduce((s, r) => s + r.recoveryMinutes, 0) / recovery.length,
        )
      : null,
    recoveryCount: recovery.length,
    skills: records.filter((r) => r.regulationAttempt?.trim()).length,
  };
}
export function parseNumber(value, max = Infinity) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max)
    throw new Error(`Use a number between 0 and ${max}.`);
  return n;
}
export const bool = (value) =>
  value === "yes" ? true : value === "no" ? false : null;
export function sampleRecords() {
  const values = [
    [
      "A different perspective at work",
      "Work",
      "My idea was questioned in a team meeting.",
      "They do not trust my judgment.",
      "Frustrated",
      7,
      "Asked which part felt unclear.",
      "We found a gap in the plan.",
      "Took a slow breath",
      12,
      true,
    ],
    [
      "Making room for a pause",
      "Relationships",
      "A conversation about housework got tense.",
      "I have to handle everything.",
      "Angry",
      8,
      "Asked for ten minutes before continuing.",
      "Came back and agreed on a plan.",
      "Stepped away",
      25,
      true,
    ],
    [
      "When plans change",
      "Everyday life",
      "A friend cancelled at the last minute.",
      "My time does not matter.",
      "Disappointed",
      5,
      "Sent a sharp message.",
      "I later acknowledged my tone.",
      "",
      40,
      false,
    ],
    [
      "Naming what I needed",
      "Work",
      "A last-minute request arrived before I logged off.",
      "I cannot say no.",
      "Anxious",
      6,
      "Explained what I could finish tomorrow.",
      "The deadline moved.",
      "Named a boundary",
      15,
      true,
    ],
  ];
  return values.map((v, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      id: `demo-${i}`,
      createdAt: d.toISOString(),
      occurredAt: localDate(d),
      title: v[0],
      context: v[1],
      narrative: v[2],
      trigger: v[2],
      automaticThought: v[3],
      emotion: v[4],
      intensity: v[5],
      response: v[6],
      outcome: v[7],
      regulationAttempt: v[8],
      recoveryMinutes: v[9],
      goalMet: v[10],
      responseGoal: "Make room for a considered response",
      recognizedTrigger: i !== 2,
      pauseAttempted: i !== 2,
      harmfulBehavior: i === 2,
      repairRelevant: i === 2,
      repaired: i === 2 ? true : null,
      physicalCues: "",
      alternativeResponse: "Ask a question before assuming intent.",
      followUp: "",
      tags: ["Communication"],
    };
  });
}

export const plural = (n, word) => n + " " + word + (n === 1 ? "" : "s");
export function displayTitle(r) {
  const text = (
    r.title ||
    r.narrative?.split(/[.!?\n]/)[0] ||
    r.trigger ||
    "Untitled moment"
  )
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 65 ? text.slice(0, 64) + "…" : text;
}
export function displayDate(r) {
  const d = new Date(r.occurredAt + "T12:00:00");
  return Number.isNaN(d.valueOf())
    ? "Date not recorded"
    : d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        ...(d.getFullYear() !== new Date().getFullYear()
          ? { year: "numeric" }
          : {}),
      });
}
export const contextLabel = (r) => r.context?.trim() || "No context";
export function northStar(records) {
  const eligible = records.filter((r) => r.kind !== "sos");
  return {
    total: eligible.length,
    met: eligible.filter((r) => r.responseGoal?.trim() && r.goalMet === true)
      .length,
    notMet: eligible.filter(
      (r) => r.responseGoal?.trim() && r.goalMet === false,
    ).length,
    unknown: eligible.filter(
      (r) => r.responseGoal?.trim() && typeof r.goalMet !== "boolean",
    ).length,
    noGoal: eligible.filter((r) => !r.responseGoal?.trim()).length,
  };
}
export function repairBreakdown(records) {
  return {
    relevant: records.filter((r) => r.repairRelevant === true).length,
    notRelevant: records.filter((r) => r.repairRelevant === false).length,
    relevanceUnknown: records.filter(
      (r) => typeof r.repairRelevant !== "boolean",
    ).length,
    repaired: records.filter(
      (r) => r.repairRelevant === true && r.repaired === true,
    ).length,
    outcomeUnknown: records.filter(
      (r) => r.repairRelevant === true && typeof r.repaired !== "boolean",
    ).length,
  };
}
export function parseRoute(hash) {
  try {
    const [path, query] = hash.replace(/^#\/?/, "").split("?");
    const parts = path.split("/").map(decodeURIComponent);
    if (parts[0] === "reflections")
      return parts[1] ? { page: "detail", id: parts[1] } : { page: "history" };
    if (parts[0] === "reflect")
      return {
        page: "reflect",
        id: parts[1] === "new" ? null : parts[1],
        step: Math.max(
          1,
          Math.min(6, Number(new URLSearchParams(query).get("step")) || 1),
        ),
      };
    if (parts[0] === "learn" && parts[1])
      return { page: "lesson", id: parts[1] };
    if (["home", "sos", "progress", "learn", "privacy"].includes(parts[0]))
      return { page: parts[0] };
    return { page: "home" };
  } catch {
    return { page: "home" };
  }
}
export function toHash(route) {
  const { page, id, step } = route;
  if (page === "history") return "#/reflections";
  if (page === "detail") return "#/reflections/" + encodeURIComponent(id);
  if (page === "reflect")
    return (
      "#/reflect/" + encodeURIComponent(id || "new") + "?step=" + (step || 1)
    );
  if (page === "lesson") return "#/learn/" + encodeURIComponent(id);
  return (
    "#/" +
    (["home", "sos", "progress", "learn", "privacy"].includes(page)
      ? page
      : "home")
  );
}
export function migrateRecord(r) {
  return {
    ...r,
    schemaVersion: 2,
    source: r.source || "text",
    kind: r.kind || "incident",
    provenance:
      r.provenance ||
      Object.fromEntries(
        Object.entries(r)
          .filter(([, v]) => v != null && v !== "")
          .map(([k]) => [
            k,
            k === "automaticThought" ? "user_interpretation" : "user_fact",
          ]),
      ),
    confirmed: r.confirmed || {},
  };
}
export const FIELD_LABELS = {
  occurredAt: "Date",
  context: "Context",
  trigger: "Trigger",
  automaticThought: "What it meant to you",
  emotion: "Feeling",
  intensity: "Intensity",
  physicalCues: "Body cues",
  response: "What you did",
  outcome: "What happened next",
  regulationAttempt: "Skill attempted",
  recoveryMinutes: "Recovery (minutes)",
  responseGoal: "Your goal",
  alternativeResponse: "Next time",
  followUp: "Follow-up",
  tagsText: "Tags",
};
