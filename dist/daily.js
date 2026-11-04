// Daily targets, evening learnings and next steps, and notification timing.
// Pure functions only: no DOM, storage or network. The splitting and sorting
// below are conservative local rules (like ai.js), not a language model; every
// result is a proposal the user confirms before it is saved.
import { MESSAGES } from "./messages.js";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// A reminder that was due while the app was closed is still shown when the
// app opens, but only within this many minutes of its scheduled time.
export const LATE_WINDOW_MINUTES = 180;
const MAX_ITEMS = 20,
  MAX_TEXT = 300;

export const emptyDay = (date) => ({
  date,
  targets: [],
  learnings: [],
  nextSteps: [],
});

export function dayStatus(day) {
  const targets = day?.targets || [];
  return {
    targets: targets.length,
    done: targets.filter((t) => t.done === true).length,
    notDone: targets.filter((t) => t.done === false).length,
    unreviewed: targets.filter((t) => typeof t.done !== "boolean").length,
    learnings: day?.learnings?.length || 0,
    nextSteps: day?.nextSteps?.length || 0,
  };
}

export function shiftDate(date, delta) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return t.toISOString().slice(0, 10);
}

// ---------- Text helpers ----------

const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s) =>
  s
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "")
    .replace(/[.!?]+$/, "")
    .trim();
export const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
const FILLER =
  /^(?:um+|uh+|so|ok(?:ay)?|well|right|yeah|that'?s (?:it|all)|and|then|also|today|tonight|this evening|nothing else|i think that'?s it)$/i;
const TRAILING_FILLER = /\s+(?:that'?s (?:it|all)|i think that'?s (?:it|all)|and that'?s (?:it|all))$/i;

// Verbs that usually start a new task. "and"/"," only split a sentence when
// the next word is one of these, so "research and write the spec" stays whole
// while "finish the report and call mum" becomes two targets.
const ACTION_VERBS = new Set(
  (
    "attend book build buy call cancel catch check clean close complete cook design do draft drink " +
    "drop eat edit email exercise file finalise finalize finish fix follow get go journal join learn " +
    "make meditate meet message order organise organize outline pay phone pick plan post practice " +
    "practise prepare prep present publish push read record refactor rehearse renew reply research " +
    "respond return review ring run schedule send set share ship sketch sleep sort spend start " +
    "stretch study submit take test text tidy update visit walk wash work write"
  ).split(" "),
);

const LEAD_IN = new RegExp(
  "^(?:(?:so|ok(?:ay)?|um+|uh+|well|right|and|also|then)[ ,]+)*" +
    "(?:(?:today|this morning|for today|tonight)[ ,]+)?" +
    "(?:(?:my|the) (?:main |big |top )?(?:targets?|goals?|tasks?|priorities|priority|plan|plans|to-?dos?)" +
    "(?: for (?:today|the day))? (?:is|are|will be|include)[ :,]*" +
    "|i (?:want|need|have|plan|hope|would like|'d like|wanna|gotta|got) to |i(?:'m| am) (?:going|planning|hoping) to " +
    "|i(?:'ll| will| should| must| can) |i've got to |let me |let's |i want |i need )?" +
    "(?:to )?",
  "i",
);

// Hard separators always split. Spoken lists rarely contain punctuation, so a
// few spoken words also count: "then", "after that", "also", "plus",
// "finally", "next one", "number two".
const HARD_SPLIT =
  /\s*(?:[\n;.!?•]+|\b(?:and then|then|after that|afterwards|also|plus|finally|lastly|first of all|firstly|secondly|thirdly|next one|next target|next task|another one|number (?:one|two|three|four|five|six|seven|eight|nine|ten))\b[,:]?)\s*/i;

function softSplit(segment) {
  // Split at "," or "and" only when an action verb follows.
  const words = segment.split(/(\s*,\s*(?:and\s+)?|\s+and\s+)/i);
  const parts = [words[0]];
  for (let i = 1; i < words.length; i += 2) {
    const sep = words[i],
      next = words[i + 1] || "";
    const firstWord = next.trim().split(/\s+/)[0]?.toLowerCase() || "";
    const leftWords = parts.at(-1).replace(LEAD_IN, "").trim().split(/\s+/).length;
    const isComma = sep.includes(",");
    if (ACTION_VERBS.has(firstWord) && (isComma || leftWords >= 2))
      parts.push(next);
    else parts[parts.length - 1] += sep + next;
  }
  return parts;
}

// "Finish the brief then call Sam and book the dentist" →
// [{ value: "Finish the brief", ... }, { value: "Call Sam" }, { value: "Book the dentist" }]
export function splitTargets(text) {
  const out = [],
    seen = new Set();
  const lines = String(text || "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "\n")
    .split(HARD_SPLIT);
  for (const line of lines) {
    if (!line || !line.trim()) continue;
    for (const raw of softSplit(line)) {
      const evidence = tidy(raw);
      let value = tidy(evidence.replace(LEAD_IN, "").replace(TRAILING_FILLER, ""));
      value = tidy(value.replace(/^(?:and|to|then)\s+/i, ""));
      if (value.length < 2 || FILLER.test(value)) continue;
      value = capitalize(value.slice(0, MAX_TEXT));
      const key = normalize(value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ value, evidence });
      if (out.length >= MAX_ITEMS) return out;
    }
  }
  return out;
}

// ---------- Matching spoken reflections to targets ----------

const STOPWORDS = new Set(
  (
    "a an the and or but to of for in on at by with from up my our your their his her its it this that " +
    "these those i me we you he she they them is was were be been am are have has had will would " +
    "should could can just really today tonight finally also didnt did not dont couldnt wasnt havent " +
    "get got manage managed able finish finished complete completed done wrap wrapped"
  ).split(" "),
);
const IRREGULAR = {
  wrote: "write",
  written: "write",
  went: "go",
  gone: "go",
  sent: "send",
  ran: "run",
  met: "meet",
  made: "make",
  bought: "buy",
  took: "take",
  taken: "take",
  spoke: "speak",
  began: "begin",
  begun: "begin",
  paid: "pay",
  read: "read",
  built: "build",
  did: "do",
  done: "do",
};
function stem(word) {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss"))
    return word.slice(0, -1);
  return word;
}
export function tokens(text) {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((w) => w && !STOPWORDS.has(w))
      .map(stem),
  );
}
// Share of the target's meaningful words that appear in the clause (an
// "overlap coefficient" measured against the target). 0.5 means at least half.
export function matchTarget(clause, targets) {
  const words = tokens(clause);
  let best = null;
  for (const t of targets || []) {
    const tw = tokens(t.text);
    if (!tw.size) continue;
    let shared = 0;
    for (const w of tw) if (words.has(w)) shared++;
    const score = shared / tw.size;
    if (shared && score >= 0.5 && (!best || score > best.score))
      best = { target: t, score };
  }
  return best?.target || null;
}

// ---------- Sorting the evening reflection ----------

const NOT_DONE =
  /\b(?:i\s+)?(?:didn'?t|did not|couldn'?t|could not|wasn'?t able to|was not able to|haven'?t|have not|never)\s+(?:get\s+(?:to|round to|around to)\s+|manage\s+to\s+|finish(?:ed)?\s+|complete\s+)?|\b(?:i\s+)?(?:ran out of time (?:for|to)|skipped|missed)\s+/i;
const DONE =
  /\b(?:i\s+)?(?:finished|completed|did|managed to|got through|wrapped up|ticked off|was able to|got)\s+|\bi'?m done with\s+|\b(?:i\s+)?(?:sent|submitted|called|emailed|booked|shipped|wrote)\b/i;
const LEARNING =
  /^(?:(?:what\s+)?(?:i|we)\s+(?:learned|learnt|realised|realized|noticed|discovered|found out|figured out|understood)(?:\s+(?:that|today|is|was))*|(?:my|one|a|the|today'?s)?\s*(?:big\s+|main\s+|key\s+)?(?:learning|lesson|takeaway|insight|realisation|realization)s?(?:\s+(?:learned|today|for today))?(?:\s+(?:is|was|are|were))?(?:\s+that)?|it turns out(?:\s+that)?|turns out(?:\s+that)?)[\s:,]*/i;
const NEXT =
  /^(?:(?:my|the|one|a)?\s*next\s+steps?(?:\s+(?:is|are|will be|for tomorrow))*(?:\s+to)?|tomorrow,?\s+(?:i\s+(?:will|want to|need to|should|plan to|am going to)|i'll|i'm going to)|going forward,?(?:\s+i\s+(?:will|'ll|want to|should))?|next time,?(?:\s+i\s+(?:will|'ll|want to|should))?|i\s+(?:will|'ll|need to|should|want to|plan to|am going to|'m going to)(?=.*\btomorrow\b)|(?:to do|todo) (?:tomorrow|next))[\s:,]*/i;
const CUE_START =
  /\b(?:i (?:learned|learnt|realised|realized|noticed|discovered|found out|figured out)|(?:my |one |the |a )?(?:big |main |key )?(?:learning|lesson|takeaway|insight)s? (?:is|was|are|were|today|for today|learned)|it turns out|(?:my |the |one )?next steps?|tomorrow,? i(?: will|'ll| want| need| should| plan| am going|'m going)|going forward|next time|i (?:didn'?t|did not|couldn'?t|finished|completed|managed to|wrapped up|got through|ran out of time|skipped|called|emailed|sent|booked|submitted|wrote|shipped)|but i)\b/gi;

function clauses(text) {
  const out = [];
  for (const sentence of String(text || "").split(/\s*(?:[\n;.!?•]+)\s*/)) {
    if (!sentence.trim()) continue;
    const starts = [0];
    for (const m of sentence.matchAll(CUE_START)) if (m.index > 0) starts.push(m.index);
    starts.push(sentence.length);
    for (let i = 0; i < starts.length - 1; i++) {
      const part = tidy(
        tidy(sentence.slice(starts[i], starts[i + 1]))
          .replace(/^(?:and|but|so|also)\s+/i, "")
          .replace(/\s+(?:and|but|so|also)$/i, ""),
      );
      if (part && !FILLER.test(part)) out.push(part);
    }
  }
  return out;
}

// Returns proposals: { kind: "learning" | "nextStep" | "done" | null, value, evidence, targetId? }
// kind null means the rules could not tell; the user chooses or skips.
export function sortReflection(text, targets = []) {
  const out = [],
    seen = new Set();
  const push = (p) => {
    const key = p.kind + ":" + (p.targetId || normalize(p.value));
    if (seen.has(key) || out.length >= MAX_ITEMS) return;
    seen.add(key);
    out.push(p);
  };
  for (const evidence of clauses(text)) {
    const learning = evidence.match(LEARNING);
    if (learning && learning[0].trim()) {
      const value = capitalize(
        tidy(evidence.slice(learning[0].length).replace(/^to\s+/i, "")),
      );
      if (value.length > 1)
        push({ kind: "learning", value: value.slice(0, MAX_TEXT), evidence });
      continue;
    }
    const next = evidence.match(NEXT);
    if (next && next[0].trim()) {
      const value = capitalize(
        tidy(
          evidence
            .slice(next[0].length)
            .replace(/^(?:to|is to|will be to)\s+/i, "")
            .replace(/\s+tomorrow$/i, ""),
        ),
      );
      if (value.length > 1)
        push({ kind: "nextStep", value: value.slice(0, MAX_TEXT), evidence });
      continue;
    }
    const negative =
        NOT_DONE.test(evidence) || /\b(?:nothing|none|no one)\b/i.test(evidence),
      positive = !negative && DONE.test(evidence);
    if (negative || positive) {
      const target = matchTarget(evidence, targets);
      if (target) {
        push({
          kind: "done",
          value: positive,
          targetId: target.id,
          targetText: target.text,
          evidence,
        });
        continue;
      }
    }
    push({ kind: null, value: capitalize(evidence.slice(0, MAX_TEXT)), evidence });
  }
  return out;
}

// Lines typed by the user and added as written (no extraction involved).
export const splitLines = (text) =>
  String(text || "")
    .split(/\n+/)
    .map((l) => capitalize(tidy(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""))))
    .filter((l) => l.length > 0)
    .map((l) => l.slice(0, MAX_TEXT))
    .slice(0, MAX_ITEMS);

// ---------- Carry-over from the previous day ----------

// Suggests last night's next steps and explicitly not-done targets from the
// most recent earlier day (within a week) that has any. Unreviewed targets
// are not suggested: not reviewed is not the same as not done.
export function carryOver(days, date) {
  const today = days?.[date] || emptyDay(date);
  const existing = new Set(today.targets.map((t) => normalize(t.text)));
  for (let i = 1; i <= 7; i++) {
    const prev = days?.[shiftDate(date, -i)];
    if (!prev) continue;
    const items = [
      ...prev.nextSteps.map((s) => ({ value: s.text, from: "Next step" })),
      ...prev.targets
        .filter((t) => t.done === false)
        .map((t) => ({ value: t.text, from: "Not done" })),
    ];
    if (!items.length) continue;
    const out = [],
      seen = new Set(existing);
    for (const item of items) {
      const key = normalize(item.value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...item, date: prev.date });
    }
    return out;
  }
  return [];
}

// ---------- Daily message ----------

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
// Day n shows message (n × stride) mod N. Because stride and N share no
// factor, n ↦ n × stride is a bijection on 0…N−1: every message appears once
// per N-day cycle, but consecutive days jump around the list.
export function dailyMessage(date, messages = MESSAGES) {
  const [y, m, d] = date.split("-").map(Number);
  const dayNumber = Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
  const n = messages.length;
  const stride = [7, 11, 13, 17, 19].find((s) => gcd(s, n) === 1) || 1;
  return messages[(((dayNumber * stride) % n) + n) % n];
}

// ---------- Notifications ----------

export const NOTIFICATION_TYPES = ["quote", "targets", "reflection"];
export const defaultNotificationSettings = () => ({
  enabled: false,
  quote: { on: true, time: "08:00" },
  targets: { on: true, time: "10:00" },
  reflection: { on: true, time: "21:00" },
  sent: {},
});
export function normalizeSettings(saved) {
  const base = defaultNotificationSettings();
  if (!saved || typeof saved !== "object") return base;
  const out = { ...base, enabled: saved.enabled === true };
  for (const type of NOTIFICATION_TYPES) {
    const s = saved[type];
    out[type] = {
      on: typeof s?.on === "boolean" ? s.on : base[type].on,
      time: TIME_RE.test(s?.time) ? s.time : base[type].time,
    };
  }
  if (saved.sent && typeof saved.sent === "object")
    for (const [date, types] of Object.entries(saved.sent))
      if (DATE_RE.test(date) && Array.isArray(types))
        out.sent[date] = types.filter((t) => typeof t === "string");
  return out;
}
const minutesOf = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export function reflectionReminderText(status) {
  const missing = [
    !status.learnings && "a learning",
    !status.nextSteps && "a next step",
  ].filter(Boolean);
  const review = status.unreviewed
    ? ` ${status.unreviewed === 1 ? "One target is" : status.unreviewed + " targets are"} still unreviewed.`
    : "";
  return `Add ${missing.join(" and ")} from today.${review}`;
}

// What should be shown now? Each type fires at most once per day, only after
// its time, only within the late window, and reminders only while their
// condition still holds.
export function dueNotifications({ now, date, day, settings, sent = [] }) {
  if (!settings?.enabled) return [];
  const minutes = now.getHours() * 60 + now.getMinutes();
  const ready = (type) => {
    const s = settings[type];
    if (!s?.on || !TIME_RE.test(s.time) || sent.includes(type)) return false;
    const late = minutes - minutesOf(s.time);
    return late >= 0 && late <= LATE_WINDOW_MINUTES;
  };
  const status = dayStatus(day);
  const due = [];
  if (ready("quote")) {
    const m = dailyMessage(date);
    due.push({
      type: "quote",
      title: "Today’s pause",
      body: m.text + (m.source ? ` — ${m.source}` : ""),
    });
  }
  if (ready("targets") && status.targets === 0)
    due.push({
      type: "targets",
      title: "What matters today?",
      body: "You haven’t added a target yet. Say or type one when you’re ready.",
    });
  if (ready("reflection") && (!status.learnings || !status.nextSteps))
    due.push({
      type: "reflection",
      title: "Evening reflection",
      body: reflectionReminderText(status),
    });
  return due;
}

// Union of two sent logs (for example from two open tabs).
export function mergeSent(a = {}, b = {}) {
  const out = { ...a };
  for (const [date, types] of Object.entries(b))
    out[date] = [...new Set([...(out[date] || []), ...types])];
  return out;
}

export function pruneSent(sent, today, keepDays = 14) {
  const oldest = shiftDate(today, -(keepDays - 1));
  return Object.fromEntries(
    Object.entries(sent || {}).filter(([d]) => d >= oldest && d <= today),
  );
}

// ---------- Validation and merge for backups ----------

const validItem = (x) =>
  x &&
  typeof x.id === "string" &&
  typeof x.text === "string" &&
  x.text.length <= 4000;
export function validateDays(days) {
  if (days == null) return {};
  if (typeof days !== "object" || Array.isArray(days))
    throw Error("This backup contains invalid daily entries.");
  for (const [date, day] of Object.entries(days)) {
    if (
      !DATE_RE.test(date) ||
      !day ||
      day.date !== date ||
      !["targets", "learnings", "nextSteps"].every(
        (k) => Array.isArray(day[k]) && day[k].every(validItem),
      ) ||
      day.targets.some((t) => t.done != null && typeof t.done !== "boolean")
    )
      throw Error("This backup contains an invalid daily entry.");
  }
  return days;
}
// Adds days and items the device doesn't have; never overwrites an existing item.
export function mergeDays(local, incoming) {
  const out = { ...local };
  for (const [date, day] of Object.entries(incoming || {})) {
    if (!out[date]) {
      out[date] = structuredClone(day);
      continue;
    }
    const merged = structuredClone(out[date]);
    for (const key of ["targets", "learnings", "nextSteps"]) {
      const ids = new Set(merged[key].map((x) => x.id));
      for (const item of day[key])
        if (!ids.has(item.id)) {
          ids.add(item.id);
          merged[key].push(structuredClone(item));
        }
    }
    out[date] = merged;
  }
  return out;
}

// ---------- Sample data for demo mode ----------

export function sampleDays(today) {
  const y = shiftDate(today, -1),
    b = shiftDate(today, -2);
  const item = (id, text, extra = {}) => ({
    id,
    text,
    source: "text",
    createdAt: new Date().toISOString(),
    ...extra,
  });
  return {
    [b]: {
      date: b,
      targets: [
        item("sd-b1", "Outline the launch brief", { done: true }),
        item("sd-b2", "Thirty-minute walk", { done: true }),
      ],
      learnings: [item("sd-b3", "Writing the outline first made the brief quicker")],
      nextSteps: [item("sd-b4", "Share the outline with Priya")],
    },
    [y]: {
      date: y,
      targets: [
        item("sd-y1", "Share the outline with Priya", { done: true }),
        item("sd-y2", "Draft the pricing section", { done: false }),
        item("sd-y3", "Call the dentist"),
      ],
      learnings: [
        item("sd-y5", "I focus best before 11am; meetings after lunch drain less"),
      ],
      nextSteps: [item("sd-y6", "Block 9–11am for the pricing section")],
    },
    [today]: {
      date: today,
      targets: [item("sd-t1", "Block 9–11am for the pricing section")],
      learnings: [],
      nextSteps: [],
    },
  };
}
