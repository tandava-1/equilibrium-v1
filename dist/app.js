import {
  localDate,
  weekRecords,
  metrics,
  parseNumber,
  bool,
  sampleRecords,
  plural,
  displayTitle,
  displayDate,
  contextLabel,
  northStar,
  parseRoute,
  toHash,
  migrateRecord,
  FIELD_LABELS,
} from "./model.js";
import { extractIncidentStub } from "./ai.js";
import {
  emptyDay,
  dayStatus,
  shiftDate,
  normalize,
  splitTargets,
  splitLines,
  sortReflection,
  carryOver,
  dailyMessage,
  dueNotifications,
  defaultNotificationSettings,
  normalizeSettings,
  mergeSent,
  pruneSent,
  validateDays,
  mergeDays,
  sampleDays,
  TIME_RE,
  LATE_WINDOW_MINUTES,
} from "./daily.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icons = {
  home: "M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10",
  book: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM13 7a3 3 0 0 1 3-3h5v15h-5a4 4 0 0 0-3 2",
  chart: "M4 20V10m8 10V4m8 16v-7",
  leaf: "M20 3C9 2 3 7 5 14s11 8 15-11ZM5 21 16 9",
  heart: "M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 5 3 10 8 15 5-5 12-10 8-15",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8",
  shield: "M12 3 3 6v6c0 6 9 10 9 10s9-4 9-10V6zM8 12l3 3 5-6",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  calendar: "M4 5h16v16H4zM8 3v4m8-4v4M4 10h16",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l4 4L20 5",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  pause: "M9 5v14m6-14v14",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  spark: "m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z",
  target:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  moon: "M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10Z",
  bell: "M6 9a6 6 0 0 1 12 0c0 6 3 8 3 8H3s3-2 3-8M10 21a2 2 0 0 0 4 0",
  close: "M6 6l12 12M18 6 6 18",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name] || icons.leaf}"/></svg>`;
const STORAGE = "equilibrium.local.v1";
let storageError = false;
const freshData = () => ({
  schemaVersion: 2,
  records: [],
  checkins: [],
  goal: "",
  practice: "",
  days: {},
  notifications: defaultNotificationSettings(),
});
function loadData(saved) {
  const out = { ...freshData(), ...saved };
  out.records = out.records.map(migrateRecord);
  out.schemaVersion = 2;
  // Keep each readable day; drop (and flag) any entry that fails validation.
  out.days = {};
  for (const [date, day] of Object.entries(saved.days || {}))
    try {
      Object.assign(out.days, validateDays({ [date]: day }));
    } catch {
      storageError = true;
    }
  out.notifications = normalizeSettings(saved.notifications);
  return out;
}
let data = freshData();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
  if (saved && Array.isArray(saved.records) && Array.isArray(saved.checkins))
    data = loadData(saved);
} catch {
  storageError = true;
}
let state = {
  page: "home",
  demo: false,
  samples: sampleRecords(),
  search: "",
  filter: "",
  draft: null,
  step: 1,
  detail: null,
  lesson: null,
  sampleDays: sampleDays(localDate()),
  todayDate: localDate(),
  today: {
    date: localDate(),
    targetText: "",
    reflectText: "",
    targetSource: "text",
    reflectSource: "text",
    targetProposals: [],
    reflectProposals: [],
  },
  listening: null,
};
try {
  const saved = JSON.parse(sessionStorage.getItem("equilibrium.today.v1"));
  if (saved?.date === localDate())
    for (const k of ["targetText", "reflectText", "targetSource", "reflectSource"])
      if (typeof saved[k] === "string") state.today[k] = saved[k];
} catch {}
let breathing = null,
  recognition = null;
try {
  state.demo = sessionStorage.getItem("equilibrium.demo") === "true";
} catch {}
function persist() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(data));
    return true;
  } catch {
    toast("Could not save to this browser. Export your data before closing.");
    return false;
  }
}
const records = () => (state.demo ? state.samples : data.records);
const sorted = () =>
  [...records()].sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) ||
      b.createdAt.localeCompare(a.createdAt),
  );
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4000);
}
function stopBreathing() {
  clearInterval(breathing);
  breathing = null;
}
function navigate(page, opts = {}) {
  const move = () => {
    stopBreathing();
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
    const hash = toHash({
      page,
      id:
        opts.id ??
        (page === "detail"
          ? state.detail
          : page === "lesson"
            ? state.lesson
            : page === "reflect"
              ? state.draft?.id
              : null),
      step: opts.step ?? state.step,
      date: opts.date,
    });
    window.history.pushState(null, "", hash);
    applyRoute();
  };
  if (
    state.page === "reflect" &&
    state.dirty &&
    page !== "reflect" &&
    !opts.force
  )
    return modal(
      "Leave this reflection?",
      "Your unsaved draft will be discarded.",
      "Discard draft",
      () => {
        clearDraft();
        move();
      },
    );
  move();
}
function modal(title, body, button, callback, danger = false) {
  const dialog = $("#dialog");
  dialog.innerHTML = `<h2>${title}</h2><p>${body}</p><div class="actions"><button class="btn secondary" id="cancel-modal">Cancel</button><button class="btn ${danger ? "danger" : ""}" id="confirm-modal">${button}</button></div>`;
  dialog.showModal();
  $("#cancel-modal").onclick = () => dialog.close();
  $("#confirm-modal").onclick = () => {
    dialog.close();
    callback();
  };
}
function layout(content) {
  const nav = [
    ["home", "home", "Home"],
    ["today", "target", "Today"],
    ["history", "book", "Reflect"],
    ["sos", "pause", "SOS"],
    ["progress", "chart", "Progress"],
    ["learn", "leaf", "Learn"],
  ];
  return `<div class="layout page-${state.page} ${state.demo ? "demo" : ""}"><aside class="sidebar"><div class="brand"><span class="brand-mark">${icon("leaf")}</span><span>equilibrium</span></div><div class="brand-sub">Space to grow</div><nav class="nav" aria-label="Main navigation">${nav.map(([id, ic, label]) => `<button data-nav="${id}" class="${state.page === id ? "active" : ""}" ${state.page === id ? 'aria-current="page"' : ""} title="${label}">${icon(ic)}<span>${label}</span></button>`).join("")}</nav><div class="sidebar-note">Small pauses.<br>Meaningful change.<small>ONE MOMENT AT A TIME</small></div><div class="sidebar-bottom"><button data-nav="privacy">${icon("shield")}<span>Your data & privacy</span></button><div class="profile"><span class="avatar">Y</span><div><strong>Your personal space</strong><small>Stored on this browser</small></div></div></div></aside><div class="main-wrap"><header class="topbar"><span class="mobile-brand">equilibrium</span><span class="status"><i class="dot"></i>A little space for yourself</span><button class="text-button" data-nav="privacy" aria-label="Your data and privacy">${icon("shield")}</button><button class="mode-button" data-action="toggle-demo">${state.demo ? "Exit sample mode" : "Try demo"}</button></header>${state.demo ? `<div class="demo-banner"><span>You’re viewing sample data. Your ${data.records.length} moments are safe and hidden.</span><button data-action="toggle-demo">Back to my data</button></div>` : ""}${storageError ? '<div class="demo-banner">Browser storage could not be read. Export any new entries before closing.</div>' : ""}<main class="content" id="main" tabindex="-1">${content}</main></div></div>`;
}
function heading(title, sub, eyebrow = "YOUR PERSONAL SPACE") {
  return `<div class="heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="date-badge">${icon("calendar")}${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div></div>`;
}
function stat(label, value, foot, ic = "leaf") {
  return `<div class="stat"><div class="stat-label">${icon(ic)}${label}</div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`;
}
function empty() {
  return `<div class="empty">${icon("book")}<h3>Your story starts with one moment.</h3><p>There’s no perfect way to reflect. Start with what happened, in your own words.</p><button class="btn secondary" data-action="new">Log your first reflection ${icon("arrow")}</button></div>`;
}
function row(r) {
  return `<button class="incident-row" data-open="${esc(r.id)}"><span class="emotion-icon ${r.kind === "sos" ? "warm" : ""}">${icon(r.kind === "sos" ? "pause" : "book")}</span><span class="incident-info"><strong>${esc(displayTitle(r))}</strong><small>${esc(contextLabel(r))} · ${esc(displayDate(r))}</small>${r.followUp ? "<small>Follow-up recorded</small>" : ""}</span>${state.demo ? '<span class="sample-tag">Sample</span>' : ""}${icon("arrow")}</button>`;
}
function home() {
  const week = weekRecords(records()),
    m = metrics(week),
    n = northStar(week);
  return (
    heading(
      "How are you, really?",
      "A little space between feeling and acting.",
      "YOUR DAILY SPACE",
    ) +
    `<div class="hero-grid"><button class="sos-entry" data-nav="sos"><span><strong>I’m triggered</strong><small>Get space right now</small></span><span class="sos-symbol">${icon("pause")}</span></button><section class="hero"><div class="eyebrow">AFTERWARDS</div><h2>Something happened?</h2><p>Say it however it comes out.<br>We’ll take it one moment at a time.</p><button class="btn" data-action="new">${icon("mic")}Tell me what happened ${icon("arrow")}</button></section></div>${todayStrip()}${!state.demo && data.goal ? `<p class="intention">This week: <strong>${esc(data.goal)}</strong></p>` : ""}<div class="section-heading"><h2>Your week</h2><button class="text-button" data-nav="progress">${plural(week.length, "episode")} ${icon("arrow")}</button></div><div class="stats">${stat("Constructive responses", n.met + n.notMet ? `${n.met} <small>of ${n.met + n.notMet}</small>` : "—", `${n.met + n.notMet ? Math.round((n.met / (n.met + n.notMet)) * 100) + "% · " : ""}${n.noGoal} no goal · ${n.unknown} unanswered`)}${stat("Paused deliberately", m.pause.total ? `${m.pause.yes} <small>of ${m.pause.total}</small>` : "—", `${m.pause.missing} unanswered`, "pause")}${stat("Recovery time", m.recoveryMedian == null ? "—" : `${m.recoveryMedian} <small>min</small>`, `Median · ${m.recoveryCount} of ${week.length} reported`, "clock")}</div><div class="bottom-grid"><section><div class="section-heading"><h2>Recent moments</h2><button class="text-button" data-nav="history">View all ${icon("arrow")}</button></div><div class="card">${sorted().length ? sorted().slice(0, 3).map(row).join("") : empty()}</div></section><section><div class="section-heading"><h2>A small thing to try</h2><span class="tag">2 MIN</span></div><div class="card lesson"><h3>A pause is a choice,<br>not a retreat.</h3><p>Make room for your feelings and choose what comes next.</p><button class="text-button" data-lesson="pause">Explore the pause ${icon("arrow")}</button></div></section></div><div class="checkin"><div><strong>A gentle daily check-in</strong><p>Have you checked for moments you want to reflect on today?</p></div><button class="btn secondary" data-action="checkin" ${state.demo || data.checkins.includes(localDate()) ? "disabled" : ""}>${data.checkins.includes(localDate()) && !state.demo ? "Checked in" : "I’ve checked in"} ${icon("check")}</button></div><p class="footer-note">Fewer logs don’t mean fewer incidents. Every moment of awareness counts.</p>`
  );
}
function history() {
  const filtered = sorted().filter(
    (r) =>
      (!state.filter || r.emotion === state.filter) &&
      [r.title, r.narrative, r.trigger, r.context, ...(r.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(state.search.toLowerCase()),
  );
  return (
    heading(
      "Room for reflection.",
      "Your moments, your words, your way forward.",
      "MY REFLECTIONS",
    ) +
    `<div class="toolbar"><input id="search" type="search" aria-label="Search reflections" placeholder="Search moments, contexts, or tags…" value="${esc(state.search)}"><select id="filter" aria-label="Filter by emotion"><option value="">All emotions</option>${[
      ...new Set(
        records()
          .map((r) => r.emotion)
          .filter(Boolean),
      ),
    ]
      .map(
        (e) =>
          `<option ${state.filter === e ? "selected" : ""}>${esc(e)}</option>`,
      )
      .join(
        "",
      )}</select><button class="btn" data-action="new">${icon("plus")}New reflection</button></div><div class="card" id="history-list">${filtered.length ? filtered.map(row).join("") : records().length ? '<div class="empty"><h3>No matching reflections</h3><p>Try another word or emotion.</p></div>' : empty()}</div>`
  );
}
function progress() {
  const w = weekRecords(records()),
    m = metrics(w),
    n = northStar(w),
    b = m.repairBreakdown;
  const checkins = state.demo ? [] : data.checkins;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const date = localDate(d);
    return {
      date,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      count: w.filter((r) => r.occurredAt === date).length,
      checked: checkins.includes(date),
    };
  });
  const metric = (label, r, foot = "") =>
    `<div class="card metric-row"><div><h3>${label}</h3><strong>${r.total ? `${r.yes} <small>of ${r.total}</small>` : "—"}</strong></div>${segments(r.yes, r.total - r.yes, r.missing)}<p>${r.missing} unanswered${foot ? " · " + foot : ""}</p></div>`;
  return (
    heading(
      "Notice the small shifts.",
      "Your last seven days, with room for what’s missing.",
      "MY PROGRESS",
    ) +
    `<div class="progress-lead"><section class="card completeness"><div class="eyebrow">DATA COMPLETENESS</div><p><strong>${plural(w.length, "episode")}</strong> logged · check-in on <strong>${days.filter((d) => d.checked).length} of 7</strong> days</p><div class="week-strip">${days.map((d) => `<div><span class="${d.checked ? "checked" : ""}" aria-label="${d.label}: ${d.count} episodes${d.checked ? ", checked in" : ""}">${d.count}</span><small>${d.label}</small></div>`).join("")}</div><p class="caption">Green = checked in. Days without a check-in may have unlogged episodes.${state.demo ? " Personal check-ins are hidden in sample mode." : ""}</p></section><section class="card northstar"><div class="eyebrow">NORTH STAR · CONSTRUCTIVE RESPONSES</div><div class="north-value">${n.met + n.notMet ? `${n.met} of ${n.met + n.notMet}` : "—"} <small>${n.met + n.notMet ? "answered · " + Math.round((n.met / (n.met + n.notMet)) * 100) + "%" : "No answered goals yet"}</small></div>${segments(n.met, n.notMet, n.unknown + n.noGoal)}<p class="caption">${n.total} incidents · ${n.met} met goal · ${n.notMet} didn’t · ${n.unknown} unanswered · <strong>${n.noGoal} no goal set (excluded)</strong>. SOS-only sessions are excluded.</p></section></div>${!w.length ? `<div class="card empty"><h2>Nothing logged in the last 7 days</h2><p>Start with one moment. There’s no score to catch up on.</p><button class="btn" data-action="new">Log a moment</button><button class="text-button" data-action="toggle-demo">Preview with sample data</button></div>` : ""}<p class="legend"><span>● Yes</span><span>● No</span><span>▧ Unknown / not applicable</span></p><div class="metric-grid">${metric("Trigger awareness", m.awareness)}${metric("Paused deliberately", m.pause, `includes ${plural(w.filter((r) => r.kind === "sos").length, "SOS session")}`)}${metric("Harmful behavior (self-reported)", m.escalation, "Lower is better")}<div class="card metric-row"><div><h3>Repair when relevant</h3><strong>${m.repair.total ? `${m.repair.yes} <small>of ${m.repair.total}</small>` : "—"}</strong></div><p>${b.notRelevant} not relevant · ${b.relevanceUnknown} relevance unknown · ${b.outcomeUnknown} repair outcomes unknown</p></div><div class="card metric-row"><div><h3>Recovery time</h3><strong>${m.recoveryMedian == null ? "—" : m.recoveryMedian + " <small>min median</small>"}</strong></div><p>${m.recoveryCount} of ${w.length} reported${m.recoveryRange ? " · range " + m.recoveryRange.join("–") + " min" : ""}</p></div><div class="card metric-row"><div><h3>Skill application</h3><strong>${m.skills}</strong></div><p>Episodes with a reported regulation attempt</p></div></div><p class="footer-note">Self-reported reflections, not a measure of clinical improvement. Fewer logs don’t mean fewer incidents.</p>`
  );
}
const lessons = {
  pause: {
    title: "A pause is a choice, not a retreat.",
    category: "MAKE A LITTLE SPACE",
    desc: "Try a short pause that protects both your feelings and your next response.",
    body: "A pause gives you time to decide what you want to say. It does not mean agreeing, giving in, or hiding how you feel.",
    steps: [
      "Notice one physical cue: tension in your jaw, a faster heartbeat, or clenched hands.",
      "If comfortable, let your next breath be a little slower. You can also simply feel your feet on the floor.",
      "Choose one sentence: “I want to talk about this. I need a moment to gather my thoughts.”",
      "Choose when to return to the conversation, if it is safe to do so.",
    ],
    prompt: "When I notice tension, I will pause before responding.",
  },
  thought: {
    title: "Separate the event from the story.",
    category: "UNDERSTAND YOUR RESPONSE",
    desc: "Get curious about the meaning you give a moment without dismissing your feelings.",
    body: "An event and your interpretation can feel like the same thing. Writing them separately can make more options visible. Your interpretation may be accurate, incomplete, or uncertain.",
    steps: [
      "Write only what you observed: “They asked me to explain the decision.”",
      "Name your interpretation: “They think I am not capable.”",
      "Ask what you know, what you do not know, and what else could explain it.",
      "Choose a response that gets information: “Which part would you like me to walk through?”",
    ],
    prompt: "Before assuming intent, I will ask one clarifying question.",
  },
  boundary: {
    title: "Clear can also be kind.",
    category: "KEEP YOUR BOUNDARIES",
    desc: "Rehearse a response that names your needs without making assumptions about others.",
    body: "A boundary describes what you need or what you will do. You do not have to win an argument to communicate one.",
    steps: [
      "Name the specific situation without labeling the person.",
      "State your need or limit in one sentence.",
      "Offer a workable next step when appropriate.",
      "Try: “I can discuss this when we can both finish our sentences. Let’s take ten minutes.”",
    ],
    prompt: "I will state my limit in one clear sentence.",
  },
  repair: {
    title: "After a difficult moment.",
    category: "MAKE ROOM FOR REPAIR",
    desc: "Take responsibility for a response while keeping your perspective and boundaries.",
    body: "You can acknowledge your behavior without denying your feelings. Repair is an invitation; it does not guarantee agreement or require staying in an unsafe interaction.",
    steps: [
      "Name the action you want to take responsibility for.",
      "Acknowledge the possible impact without deciding how the other person feels.",
      "Explain what you want to do differently next time.",
      "Try: “I interrupted you earlier. I’d like to hear what you were saying.”",
    ],
    prompt:
      "When needed and safe, I will acknowledge my part and invite a fresh conversation.",
  },
};
function learn() {
  return (
    heading(
      "Small skills. Real moments.",
      "Short exercises to bring into your everyday life.",
      "LEARN & PRACTICE",
    ) +
    `<div class="learning-grid">${Object.entries(lessons)
      .map(
        ([id, l]) =>
          `<div class="card"><div class="eyebrow">${l.category} · 2 MIN</div><h2>${l.title}</h2><p>${l.desc}</p><button class="text-button" data-lesson="${id}">Explore this practice ${icon("arrow")}</button></div>`,
      )
      .join(
        "",
      )}</div><div class="card practice"><h2>Your practice intention</h2><p>Choose one small action you want to try. You can change it anytime.</p><form id="goal-form"><label for="goal">This week, I want to…</label><input id="goal" maxlength="300" placeholder="Pause and ask a question when I feel challenged" value="${esc(state.demo ? "Ask a clarifying question before assuming intent." : data.goal)}"><label for="practice" class="section-heading">Rehearse your words</label><textarea id="practice" maxlength="3000" placeholder="What could you say in the moment?">${esc(state.demo ? "" : data.practice)}</textarea><button class="btn" ${state.demo ? "disabled" : ""}>Save my practice</button></form></div>`
  );
}
function lesson() {
  const l = lessons[state.lesson];
  return `<div class="article"><button class="text-button" data-nav="learn">← Back to learning</button><div class="eyebrow section-heading">${l.category}</div><h1>${l.title}</h1><p>${l.body}</p><h2>Give it a try</h2><ol>${l.steps.map((s) => `<li>${s}</li>`).join("")}</ol><div class="card practice"><h3>A practice intention</h3><p>${l.prompt}</p><button class="btn" data-action="use-practice">Use this intention ${icon("arrow")}</button></div><p class="footer-note">General reflection exercises, not diagnosis or therapy.</p></div>`;
}
function sos() {
  const scripts = [
    [
      "ASK FOR A PAUSE",
      "I want to respond thoughtfully. I need a few minutes.",
    ],
    ["KEEP A BOUNDARY", "I’m open to talking. I need us to lower our voices."],
    ["GET CURIOUS", "Can you help me understand what you mean?"],
  ];
  const script = scripts[state.script || 0];
  return `<div class="sos-page">${state.sosMode === "outcome" ? `<div class="eyebrow">AFTER YOUR PAUSE</div><h1>How did it go?</h1><p>Choose what fits. You can skip this.</p><div class="choice-stack"><button class="choice" data-sos-outcome="paused">I paused before responding</button><button class="choice" data-sos-outcome="regret">I said something I regret</button><button class="choice" data-sos-outcome="unknown">Still in it, not now</button></div><button class="text-button" data-nav="home">Skip for now</button>` : state.sosMode === "saved" ? `<div class="eyebrow">A MOMENT OF AWARENESS</div><h1>Your check-in is saved.</h1><p>Your answers stay as you reported them. Unknown details remain unanswered.</p><button class="btn" data-action="new">Tell me what happened ${icon("arrow")}</button><button class="text-button" data-nav="home">Return to my space</button>` : `<div class="eyebrow">RIGHT NOW</div><h1>You can step back.</h1><p>Say this, then step away if you need to.</p><section class="card script-card"><div class="eyebrow">${script[0]} · ${(state.script || 0) + 1} OF 3</div><blockquote>“${script[1]}”</blockquote><div class="script-controls"><button class="text-button" data-action="script-prev" aria-label="Previous script">←</button><span>${scripts.map((_, i) => (i === (state.script || 0) ? "●" : "○")).join(" ")}</span><button class="text-button" data-action="script-next" aria-label="Next script">→</button></div></section>${!state.demo && data.goal ? `<p class="intention">Your intention: ${esc(data.goal)}</p>` : ""}<div class="sos-options"><button class="card" data-action="breathe">${icon("leaf")}<span>Breathe<small>1 minute</small></span></button><button class="card" data-action="ground">${icon("sun")}<span>Ground<small>5–4–3–2–1</small></span></button><button class="card" data-action="away">${icon("arrow")}<span>Step away<small>10 minutes</small></span></button></div>${state.sosMode === "grounding" ? `<section class="card exercise"><div class="eyebrow">GROUNDING · ${(state.groundStep || 0) + 1} OF 5</div><h2 aria-live="polite">${["Name 5 things you can see.", "Notice 4 things you can feel.", "Listen for 3 things you can hear.", "Notice 2 things you can smell.", "Notice 1 taste, or take a comfortable breath."][state.groundStep || 0]}</h2><div class="actions"><button class="btn secondary" data-action="sos-stop">Stop</button><button class="btn" data-action="ground-next">${state.groundStep === 4 ? "Done" : "Next"}</button></div></section>` : ["breathing", "away"].includes(state.sosMode) ? `<section class="card exercise"><h2 id="exercise-label">${state.sosMode === "breathing" ? "Breathe comfortably" : "Give yourself some space"}</h2><p id="exercise-timer" role="timer">${state.sosMode === "breathing" ? "One minute, at your own pace" : "Return when you feel ready"}</p><p>${state.sosMode === "breathing" ? "Stop if the pace feels uncomfortable." : `You can return around ${new Date(Date.now() + 600000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`}</p><button class="btn secondary" data-action="sos-stop">Stop</button></section>` : ""}<button class="btn secondary full-width" data-action="sos-done">I’m done — check in ${icon("check")}</button>`}<aside class="crisis-bar"><strong>In danger, or might hurt yourself or someone else?</strong><span>Move to safety if possible. Contact local emergency services or a trusted person now.</span></aside></div>`;
}
const textField = (key, label, placeholder = "", wide = false) =>
  `<div class="field ${wide ? "span-2" : ""}"><label for="${key}">${label}</label><textarea id="${key}" name="${key}" maxlength="4000" placeholder="${placeholder}">${esc(state.draft[key])}</textarea></div>`;
const inputField = (key, label, type = "text", extra = "") =>
  `<div class="field"><label for="${key}">${label}</label><input id="${key}" name="${key}" type="${type}" value="${esc(state.draft[key])}" ${extra}></div>`;
function tri(key, label) {
  const val = state.draft[key];
  return `<div class="field"><label for="${key}">${label}</label><select id="${key}" name="${key}"><option value="unknown">Not sure / not answered</option><option value="yes" ${val === true ? "selected" : ""}>Yes</option><option value="no" ${val === false ? "selected" : ""}>No</option></select></div>`;
}
function reflect() {
  const d = state.draft;
  if (!d) return "";
  const editor = () =>
    `<div class="form-grid">${inputField("title", "Title", "text", 'maxlength="120"')}${inputField("occurredAt", "Date", "date", `required max="${localDate()}"`)}${Object.entries(
      FIELD_LABELS,
    )
      .filter(
        ([k]) => !["occurredAt", "intensity", "recoveryMinutes"].includes(k),
      )
      .map(([k, label]) =>
        inputField(
          k,
          label,
          "text",
          `maxlength="${k === "tagsText" ? 300 : 4000}"`,
        ),
      )
      .join(
        "",
      )}${inputField("intensity", "Intensity (0–10)", "number", 'min="0" max="10" step="1"')}${inputField("recoveryMinutes", "Recovery in minutes (up to 1440 / 24 h)", "number", 'min="0" max="1440" step="1"')}</div>`;
  const question =
    state.step === 3
      ? `<h2>Your goal for this moment</h2><p>What response were you aiming for? Your weekly intention is a starting point, not a requirement.</p>${inputField("responseGoal", "I wanted to…", "text", 'maxlength="300" placeholder="Listen without interrupting"')}`
      : state.step === 4
        ? `<h2>Did your response match your goal?</h2><p class="intention">“${esc(d.responseGoal)}”</p>${choices("goalMet")}`
        : state.step === 5
          ? `<h2>Did you try to pause?</h2><p>A pause can be brief. Choose what you remember.</p>${choices("pauseAttempted")}`
          : "";
  return `<div class="form-card">${heading(state.step === 1 ? "Tell me what happened." : state.step === 2 ? "Here’s what I heard." : state.step === 6 ? "Your moment, in your words." : "A little reflection.", "Nothing is saved until you confirm.", "SOMETHING HAPPENED")}<div class="steps"><span class="${state.step === 1 ? "current" : ""}">1 · Capture</span><span class="${state.step >= 2 && state.step <= 5 ? "current" : ""}">2 · Reflect</span><span class="${state.step === 6 ? "current" : ""}">3 · Save</span></div><form id="reflect-form">${
    state.step === 1
      ? `<button type="button" class="voice-orb" data-action="voice">${icon("mic")}<span id="voice-label">Tap to speak</span></button><p class="voice-note">Audio is never stored by Equilibrium.</p><label for="narrative">Or type what happened</label><textarea id="narrative" name="narrative" maxlength="10000" placeholder="What happened? What came up for you?">${esc(d.narrative || "")}</textarea><p class="notice">Voice uses your browser’s speech service and needs your consent. Typed text stays in this browser.</p>`
      : state.step === 2
        ? `<p>Check the suggestions below. Local rules look for words you used; this is not AI analysis. Unaccepted suggestions won’t be saved.</p><div class="proposal-list">${
            Object.entries(state.proposals || {})
              .map(
                ([key, p]) =>
                  `<section class="card proposal ${p.provenance === "local_suggestion" ? "inferred" : ""}"><div class="proposal-head"><label for="proposal-${key}">${FIELD_LABELS[key]}</label>${provenance(p.provenance)}</div><input id="proposal-${key}" data-proposal-input="${key}" value="${esc(p.value)}" ${["intensity", "recoveryMinutes"].includes(key) ? `type="number" min="0" max="${key === "intensity" ? 10 : 1440}" step="1"` : 'type="text" maxlength="4000"'}><p class="evidence">From: “${esc(p.evidence)}”</p><div class="actions"><button class="btn ${d.confirmed?.[key] ? "" : "secondary"}" type="button" data-confirm="${key}">${d.confirmed?.[key] ? "✓ Confirmed" : "Confirm"}</button><button class="text-button" type="button" data-remove="${key}">Remove</button></div></section>`,
              )
              .join("") ||
            '<div class="hint">No specific fields were suggested. Your original words are kept; you can add details below.</div>'
          }</div><details class="optional-fields"><summary>Add or correct details</summary>${editor()}</details>`
        : state.step < 6
          ? `<div class="card question-card">${question}</div>`
          : `<h2>${esc(displayTitle(d))}</h2><p class="narrative">${esc(d.narrative || "")}</p><dl class="detail-grid">${Object.entries(
              FIELD_LABELS,
            )
              .filter(([k]) => d[k] != null && d[k] !== "")
              .map(
                ([k, label]) =>
                  `<div><dt>${label}</dt><dd>${esc(k === "occurredAt" ? displayDate(d) : d[k])}</dd></div>`,
              )
              .join(
                "",
              )}</dl><p>${d.responseGoal ? `Goal matched: ${answer(d.goalMet)}` : "No goal set · excluded from the constructive-response rate."}</p><p>Pause attempted: ${answer(d.pauseAttempted)}</p><details class="optional-fields"><summary>Want to add more?</summary>${editor()}${tri("recognizedTrigger", "Did you recognize the trigger before or during your response?")}${tri("harmfulBehavior", "Did you identify harmful behavior in your response?")}${tri("repairRelevant", "Was constructive repair relevant?")}${tri("repaired", "If relevant, has repair happened?")}</details>`
  }<div class="form-actions"><button type="button" class="btn secondary" data-action="${state.step === 1 ? "cancel-reflect" : "back-step"}">${state.step === 1 ? "Cancel" : "Back"}</button>${state.step >= 3 && state.step <= 5 ? '<button type="button" class="text-button" data-action="skip-question">Skip</button>' : ""}<button class="btn">${state.step === 1 ? "Review my words" : state.step === 6 ? "Save reflection" : "Continue"} ${icon("arrow")}</button></div></form></div>`;
}
function detail() {
  const r = records().find((r) => r.id === state.detail);
  if (!r) return history();
  const groups = [
    ["Trigger", ["trigger"]],
    ["What it meant to you", ["automaticThought"]],
    ["Feeling", ["emotion", "intensity", "physicalCues"]],
    ["What you did", ["response", "regulationAttempt"]],
    ["What happened next", ["outcome", "recoveryMinutes"]],
    ["Looking back", ["responseGoal", "alternativeResponse", "followUp"]],
  ];
  return `<button class="text-button" data-nav="history">← All moments</button>${heading(esc(displayTitle(r)), `${esc(displayDate(r))} · ${esc(contextLabel(r))}`, "MY REFLECTION")}<div class="story-meta"><span class="tag">${esc(r.source || "Text")}</span>${state.demo ? '<span class="sample-tag">Sample</span>' : ""}${(r.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>${r.narrative ? `<section class="card story"><div class="eyebrow">YOUR WORDS</div><p class="narrative ${r.narrative.length > 600 ? "clamped" : ""}" id="story-text">${esc(r.narrative)}</p>${r.narrative.length > 600 ? '<button class="text-button" data-action="expand-story" aria-expanded="false">Show full story</button>' : ""}</section>` : ""}<div class="timeline">${groups
    .map(
      ([title, keys]) =>
        `<section><h2>${title}</h2>${
          keys
            .filter((k) => r[k] != null && r[k] !== "")
            .map(
              (k) =>
                `<div class="timeline-value">${provenance(r.provenance?.[k] || (k === "automaticThought" ? "user_interpretation" : "user_fact"))}<p>${esc(r[k])}${k === "intensity" ? " / 10" : k === "recoveryMinutes" ? " minutes" : ""}</p></div>`,
            )
            .join("") ||
          '<button class="text-button" data-action="edit">Not recorded · Add</button>'
        }</section>`,
    )
    .join(
      "",
    )}</div><div class="card"><h3>Your reported outcomes</h3><p>Goal matched: ${r.responseGoal ? answer(r.goalMet) : "Not applicable — no goal set"}<br>Pause attempted: ${answer(r.pauseAttempted)}<br>Trigger recognized: ${answer(r.recognizedTrigger)}<br>Harmful behavior: ${answer(r.harmfulBehavior)}<br>Repair relevant: ${answer(r.repairRelevant)}<br>Repair completed: ${r.repairRelevant === false ? "Not applicable" : answer(r.repaired)}</p></div><div class="form-actions"><button class="btn secondary danger-text" data-action="delete">Delete</button><button class="btn" data-action="edit">Edit moment</button></div>`;
}
function privacy() {
  return (
    `<button class="text-button" data-nav="home">← Home</button>` +
    heading(
      "Your space. Your control.",
      "Understand what is stored and choose what stays.",
      "DATA & PRIVACY",
    ) +
    `<div class="hint">Local MVP · No account or live AI connection. Text entries stay in this browser’s local storage unless you export them. Browser storage is not encrypted by this app and may be accessible to others using this browser profile.</div><div class="privacy-grid"><div class="card"><h2>Restore a backup</h2><p>Merge a JSON export into your data. Existing IDs are kept.</p><label for="import-file">Import a backup</label><input id="import-file" type="file" accept="application/json,.json"></div><div class="card"><h2>A quick introduction</h2><p>How reflection, voice and local storage work.</p><button class="btn secondary" data-action="intro">Replay introduction</button></div><div class="card"><h2>Take your data with you</h2><p>Export your personal reflections, check-ins, practice notes, daily targets, learnings and next steps as JSON. Sample data is excluded.</p><button class="btn secondary" data-action="export">${icon("download")}Export my data</button></div><div class="card"><h2>A fresh start</h2><p>Delete all personal data saved by Equilibrium in this browser. Export first if you want a copy.</p><button class="btn secondary" data-action="clear">Delete all my data</button></div><div class="card"><h2>Voice is your choice</h2><p>Voice capture uses your browser’s speech recognition service, which may send audio to its provider. Permission is requested before capture. Equilibrium retains the transcript only when you save a reflection or add an item, and never stores audio.</p></div><div class="card"><h2>Notifications stay local</h2><p>Daily messages and reminders are scheduled by this browser tab, with no push server. Their text never includes your entries, so nothing personal shows on a lock screen.</p></div><div class="card"><h2>Memory you can see</h2><p>Your saved reflections, practice intention and daily entries are the only personal memory in this version. Edit or remove any of them. There are no hidden personality labels or inferred diagnoses.</p></div></div><div class="card insight"><h2>A companion for reflection</h2><p>Equilibrium offers general reflection and practice tools. It does not diagnose, provide therapy, or establish clinical improvement. Your personal data is not backed up or synced; clearing browser storage removes it.</p></div>`
  );
}
// ---------- Today: targets, learnings, next steps ----------
const days = () => (state.demo ? state.sampleDays : data.days);
const dayFor = (date) => days()[date] || emptyDay(date);
const shortDate = (date) =>
  new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
function todayStrip() {
  const s = dayStatus(days()[localDate()]);
  return `<button class="today-strip" data-nav="today"><span class="today-icon">${icon("target")}</span><span><strong>Today</strong><small>${s.targets ? `${s.done} of ${s.targets} targets done` : "No targets yet"} · ${s.learnings || s.nextSteps ? "reflection started" : "reflection not added"}</small></span>${icon("arrow")}</button>`;
}
function targetRow(t) {
  const label = esc(t.text);
  return `<li class="target-row ${t.done === true ? "done" : t.done === false ? "not-done" : ""}"><span class="target-text">${label}</span><span class="target-status" role="group" aria-label="Review: ${label}"><button data-target-status="${esc(t.id)}" data-value="true" aria-pressed="${t.done === true}">${icon("check")}Done</button><button data-target-status="${esc(t.id)}" data-value="false" aria-pressed="${t.done === false}">Not done</button></span><button class="icon-button" data-target-remove="${esc(t.id)}" aria-label="Remove target: ${label}">${icon("close")}</button></li>`;
}
function itemList(kind, items, emptyText) {
  return items.length
    ? `<ul class="day-items">${items.map((item) => `<li><span>${esc(item.text)}</span><button class="icon-button" data-item-remove="${kind}:${esc(item.id)}" aria-label="Remove: ${esc(item.text)}">${icon("close")}</button></li>`).join("")}</ul>`
    : `<p class="day-empty">${emptyText}</p>`;
}
function capture({ id, label, placeholder, tip, voiceAction, buttons }) {
  const listening = state.listening === id;
  return `<div class="capture"><div class="capture-head"><label for="${id}">${label}</label><button type="button" class="voice-mini ${listening ? "listening" : ""}" data-action="${voiceAction}" aria-label="${listening ? "Stop listening" : "Speak instead of typing"}">${icon("mic")}<span id="${id}-voice">${listening ? "Listening · tap to stop" : "Speak"}</span></button></div><textarea id="${id}" maxlength="3000" placeholder="${placeholder}">${esc(id === "target-input" ? state.today.targetText : state.today.reflectText)}</textarea><p class="notice">${tip}</p><div class="capture-actions">${buttons}</div></div>`;
}
function targetProposals() {
  const list = state.today.targetProposals;
  if (!list.length) return "";
  return `<div class="proposal-list day-proposals"><p class="caption">Local rules split your words into targets. Edit, add or remove each one; nothing is added until you choose.</p>${list
    .map(
      (p, i) =>
        `<section class="proposal inferred"><div class="proposal-head"><label for="tp-${i}">Target</label>${provenance("local_suggestion")}</div><input id="tp-${i}" data-tp-input="${i}" maxlength="300" value="${esc(p.value)}"><p class="evidence">From: “${esc(p.evidence)}”</p><div class="actions"><button class="btn" data-tp-add="${i}">Add</button><button class="text-button" data-tp-remove="${i}">Remove</button></div></section>`,
    )
    .join(
      "",
    )}${list.length > 1 ? `<button class="btn secondary" data-action="add-all-targets">Add all ${list.length}</button>` : ""}</div>`;
}
const KIND_LABEL = { learning: "Learning", nextStep: "Next step" };
function reflectProposals() {
  const list = state.today.reflectProposals;
  if (!list.length) return "";
  return `<div class="proposal-list day-proposals"><p class="caption">Local rules sorted your words. Check each one; lines the rules couldn’t place need you to choose.</p>${list
    .map((p, i) =>
      p.kind === "done"
        ? `<section class="proposal inferred"><div class="proposal-head"><span class="proposal-label">Target review</span>${provenance("local_suggestion")}</div><p class="proposal-value">Mark “${esc(p.targetText)}” as <strong>${p.value ? "done" : "not done"}</strong></p><p class="evidence">From: “${esc(p.evidence)}”</p><div class="actions"><button class="btn" data-rp-add="${i}">Confirm</button><button class="text-button" data-rp-remove="${i}">Remove</button></div></section>`
        : `<section class="proposal ${p.kind ? "inferred" : ""}"><div class="proposal-head"><label for="rp-${i}">${KIND_LABEL[p.kind] || "Not sorted"}</label>${provenance(p.kind ? "local_suggestion" : "user_fact")}</div><input id="rp-${i}" data-rp-input="${i}" maxlength="300" value="${esc(p.value)}">${p.evidence !== p.value ? `<p class="evidence">From: “${esc(p.evidence)}”</p>` : ""}<div class="actions"><select data-rp-kind="${i}" aria-label="Save as"><option value="">Save as…</option>${Object.entries(
            KIND_LABEL,
          )
            .map(
              ([k, label]) =>
                `<option value="${k}" ${p.kind === k ? "selected" : ""}>${label}</option>`,
            )
            .join(
              "",
            )}</select><button class="btn" data-rp-add="${i}" ${p.kind ? "" : "disabled"}>Add</button><button class="text-button" data-rp-remove="${i}">Remove</button></div></section>`,
    )
    .join("")}</div>`;
}
function weekStrip(date) {
  return `<div class="day-strip">${Array.from({ length: 7 }, (_, i) =>
    shiftDate(localDate(), i - 6),
  )
    .map((d) => {
      const s = dayStatus(days()[d]),
        reflected = s.learnings + s.nextSteps > 0;
      return `<button data-day="${d}" class="${d === date ? "current" : ""}" ${d === date ? 'aria-current="date"' : ""} aria-label="${shortDate(d)}: ${s.targets ? `${s.done} of ${s.targets} targets done` : "no targets"}${reflected ? ", reflection added" : ""}"><small>${new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}</small><strong>${s.targets ? `${s.done}/${s.targets}` : "–"}</strong><i class="${reflected ? "on" : ""}" aria-hidden="true"></i></button>`;
    })
    .join("")}</div>`;
}
function notificationsCard() {
  const n = data.notifications,
    supported = "Notification" in window,
    permission = supported ? Notification.permission : "unsupported",
    active = n.enabled && permission === "granted",
    lock = state.demo ? "disabled" : "";
  const row = (type, label, help) =>
    `<div class="notify-row"><label class="notify-toggle"><input type="checkbox" data-notify-on="${type}" ${n[type].on ? "checked" : ""} ${lock}><span><strong>${label}</strong><small>${help}</small></span></label><input type="time" data-notify-time="${type}" value="${n[type].time}" aria-label="${label} time" ${lock}></div>`;
  const status = !supported
    ? "This browser can’t show notifications."
    : !window.isSecureContext
      ? "Notifications need a secure page (https, or this computer’s localhost)."
      : permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser’s site settings, then reload."
        : active
          ? "On. Each one is sent at most once a day."
          : "Off.";
  return `<section class="card notify-card" id="notifications"><div class="section-heading"><h2>${icon("bell")}Notifications</h2>${active ? '<span class="tag">ON</span>' : ""}</div><p>${status}${state.demo ? " Settings are locked in sample mode." : ""}</p>${row("quote", "Daily message", "A quote or mindfulness line")}${row("targets", "Target reminder", "Only if no target has been added")}${row("reflection", "Evening reminder", "Only if learnings or next steps are missing")}<div class="actions">${supported && permission !== "denied" && window.isSecureContext ? `<button class="btn ${active ? "secondary" : ""}" data-action="notify-toggle" ${lock}>${active ? "Turn off" : "Turn on notifications"}</button>` : ""}${active ? '<button class="text-button" data-action="notify-test">Send a test</button>' : ""}</div><p class="notice">Sent by this browser, with no server. They arrive while Equilibrium is open in a tab, even in the background; nothing can arrive once it’s closed. A missed one appears when you return, up to ${LATE_WINDOW_MINUTES / 60} hours late. Notification text never includes your entries.</p></section>`;
}
function today() {
  const date = state.todayDate,
    isToday = date === localDate(),
    day = dayFor(date),
    s = dayStatus(day),
    msg = dailyMessage(date),
    carry = isToday ? carryOver(days(), date) : [];
  return (
    heading(
      isToday ? "What matters today?" : "Looking back.",
      isToday
        ? "Set targets in the morning. Reflect at night."
        : "Review this day’s targets, learnings and next steps.",
      isToday ? "TODAY" : "PAST DAY",
    ) +
    `<div class="day-nav"><button class="text-button" data-day="${shiftDate(date, -1)}" aria-label="Previous day">←</button><strong>${isToday ? "Today · " : ""}${shortDate(date)}</strong><button class="text-button" data-day="${shiftDate(date, 1)}" aria-label="Next day" ${isToday ? "disabled" : ""}>→</button></div>${weekStrip(date)}<section class="card day-message"><div class="eyebrow">${isToday ? "TODAY’S PAUSE" : "THAT DAY’S PAUSE"}</div><blockquote>${esc(msg.text)}</blockquote>${msg.source ? `<cite>${esc(msg.source)}</cite>` : ""}</section><section class="day-section"><div class="section-heading"><h2>${icon("target")}Targets</h2><span class="tag">${s.targets ? `${s.done} OF ${s.targets} DONE` : "NONE YET"}</span></div><div class="card">${
      s.targets
        ? `<ul class="target-list">${day.targets.map(targetRow).join("")}</ul><p class="caption">${s.done} done · ${s.notDone} not done · ${s.unreviewed} not reviewed</p>`
        : `<p class="day-empty">No targets ${isToday ? "yet" : "recorded for this day"}.</p>`
    }${
      carry.length
        ? `<div class="carry"><h3>Carry over from ${esc(shortDate(carry[0].date))}?</h3><ul>${carry.map((c, i) => `<li><span><small>${c.from}</small>${esc(c.value)}</span><button class="btn secondary" data-carry="${i}" aria-label="Add target: ${esc(c.value)}">${icon("plus")}Add</button></li>`).join("")}</ul></div>`
        : ""
    }${capture({
      id: "target-input",
      label: isToday ? "What do you want to get done today?" : "Add targets for this day",
      placeholder: "Finish the launch brief, then call Sam. Also a 20-minute walk.",
      tip: "Speaking? Say “then” or “next one” between targets.",
      voiceAction: "voice-targets",
      buttons:
        '<button class="btn" data-action="suggest-targets">Suggest targets</button><button class="btn secondary" data-action="add-targets-raw">Add each line as written</button>',
    })}${targetProposals()}</div></section><section class="day-section"><div class="section-heading"><h2>${icon("moon")}${isToday ? "Tonight" : "That evening"}</h2><span class="tag">${s.learnings + s.nextSteps ? `${s.learnings} · ${s.nextSteps}` : "NOT YET"}</span></div><div class="card"><h3>Learnings</h3>${itemList("learnings", day.learnings, "No learnings added.")}<h3>Next steps</h3>${itemList("nextSteps", day.nextSteps, "No next steps added. They’ll be offered as targets tomorrow.")}${capture({
      id: "reflect-input",
      label: "How did the day go?",
      placeholder: "I learned that… My next step is… I finished… I didn’t get to…",
      tip: "Try “I learned…”, “Next step…”, and “I finished…” or “I didn’t get to…” to review targets.",
      voiceAction: "voice-reflect",
      buttons:
        '<button class="btn" data-action="sort-reflection">Sort my words</button><button class="btn secondary" data-action="add-learning-raw">Add as learning</button><button class="btn secondary" data-action="add-next-raw">Add as next step</button>',
    })}${reflectProposals()}</div></section>${notificationsCard()}<p class="footer-note">Not done is information, not a verdict. Unreviewed targets stay unreviewed.</p>`
  );
}
function cacheToday() {
  try {
    const t = state.today;
    sessionStorage.setItem(
      "equilibrium.today.v1",
      JSON.stringify({
        date: localDate(),
        targetText: t.targetText,
        reflectText: t.reflectText,
        targetSource: t.targetSource,
        reflectSource: t.reflectSource,
      }),
    );
  } catch {}
}
const newItem = (text, source) => ({
  id: makeId(),
  text: text.trim().slice(0, 300),
  source,
  createdAt: new Date().toISOString(),
});
// Applies a change to one day, saves, and re-renders. Restores on save failure.
function updateDay(change, message) {
  const date = state.todayDate,
    store = days(),
    previous = store[date],
    day = structuredClone(previous || emptyDay(date));
  change(day);
  if (!day.targets.length && !day.learnings.length && !day.nextSteps.length)
    delete store[date];
  else store[date] = day;
  if (!state.demo && !persist()) {
    if (previous) store[date] = previous;
    else delete store[date];
  } else if (message) toast(message);
  render();
}
function addTargets(texts, source) {
  let added = 0,
    skipped = 0;
  updateDay((day) => {
    const existing = new Set(day.targets.map((t) => normalize(t.text)));
    for (const text of texts) {
      const key = normalize(text);
      if (!key || existing.has(key)) {
        skipped++;
        continue;
      }
      existing.add(key);
      day.targets.push({ ...newItem(text, source), done: null });
      added++;
    }
  });
  toast(
    added
      ? `${plural(added, "target")} added.${skipped ? ` ${skipped} already listed.` : ""}`
      : "Already in this day’s targets.",
  );
  return added;
}
function addItems(kind, texts, source) {
  updateDay(
    (day) => day[kind].push(...texts.map((t) => newItem(t, source))),
    `${plural(texts.length, kind === "learnings" ? "learning" : "next step")} added.`,
  );
}
function clearCapture(which) {
  state.today[which + "Text"] = "";
  state.today[which + "Source"] = "text";
  cacheToday();
}
function todayAction(a) {
  const t = state.today;
  if (a === "voice-targets" || a === "voice-reflect") {
    const which = a === "voice-targets" ? "target" : "reflect";
    return voice({
      field: which + "-input",
      idle: "Speak",
      consent:
        "Your browser may send audio to its speech provider. Equilibrium stores no audio. Only words you review and add are saved.",
      onText: (text) => {
        t[which + "Text"] = text;
        t[which + "Source"] = "voice";
        cacheToday();
      },
    });
  }
  if (a === "suggest-targets" || a === "add-targets-raw") {
    const text = $("#target-input")?.value ?? t.targetText;
    if (!text.trim()) {
      toast("Say or type a target first.");
      return $("#target-input")?.focus();
    }
    if (a === "add-targets-raw") {
      if (addTargets(splitLines(text), t.targetSource)) clearCapture("target");
      return render();
    }
    const existing = new Set(dayFor(state.todayDate).targets.map((x) => normalize(x.text)));
    t.targetProposals = splitTargets(text)
      .filter((p) => !existing.has(normalize(p.value)))
      .map((p) => ({ ...p, source: t.targetSource }));
    if (!t.targetProposals.length)
      return toast("No new targets found. Try “then” between them, or add each line as written.");
    clearCapture("target");
    render();
    document.querySelector(".day-proposals")?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (a === "add-all-targets") {
    const list = t.targetProposals.filter((p) => p.value.trim());
    t.targetProposals = [];
    return addTargets(
      list.map((p) => p.value),
      list[0]?.source || "text",
    );
  }
  if (a === "sort-reflection" || a === "add-learning-raw" || a === "add-next-raw") {
    const text = $("#reflect-input")?.value ?? t.reflectText;
    if (!text.trim()) {
      toast("Say or type something about the day first.");
      return $("#reflect-input")?.focus();
    }
    if (a !== "sort-reflection") {
      addItems(a === "add-learning-raw" ? "learnings" : "nextSteps", splitLines(text), t.reflectSource);
      clearCapture("reflect");
      return render();
    }
    t.reflectProposals = sortReflection(text, dayFor(state.todayDate).targets).map((p) => ({
      ...p,
      source: t.reflectSource,
    }));
    if (!t.reflectProposals.length) return toast("Nothing to sort yet. Add a few more words.");
    clearCapture("reflect");
    render();
    document.querySelector(".day-proposals")?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (a === "notify-toggle") return toggleNotifications();
  if (a === "notify-test")
    return deliver({
      type: "test",
      title: "Notifications are on",
      body: "This is how Equilibrium’s daily message and reminders will appear.",
    }).then((ok) => toast(ok ? "Test sent." : "This browser didn’t show the notification."));
}
function bindToday() {
  const t = state.today;
  for (const [id, which] of [
    ["target-input", "target"],
    ["reflect-input", "reflect"],
  ]) {
    const el = $("#" + id);
    if (el)
      el.oninput = () => {
        t[which + "Text"] = el.value;
        if (!el.value) t[which + "Source"] = "text";
        cacheToday();
      };
  }
  const each = (sel, fn) => document.querySelectorAll(sel).forEach(fn);
  each("[data-tp-input]", (el) => (el.oninput = () => (t.targetProposals[+el.dataset.tpInput].value = el.value)));
  each("[data-rp-input]", (el) => (el.oninput = () => (t.reflectProposals[+el.dataset.rpInput].value = el.value)));
  each(
    "[data-rp-kind]",
    (el) =>
      (el.onchange = () => {
        t.reflectProposals[+el.dataset.rpKind].kind = el.value || null;
        render();
      }),
  );
  each(
    "[data-tp-remove]",
    (b) =>
      (b.onclick = () => {
        t.targetProposals.splice(+b.dataset.tpRemove, 1);
        render();
      }),
  );
  each(
    "[data-rp-remove]",
    (b) =>
      (b.onclick = () => {
        t.reflectProposals.splice(+b.dataset.rpRemove, 1);
        render();
      }),
  );
  each(
    "[data-tp-add]",
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.tpAdd,
          p = t.targetProposals[i];
        if (!p.value.trim()) return toast("Write the target first, or remove it.");
        t.targetProposals.splice(i, 1);
        addTargets([p.value], p.source);
      }),
  );
  each(
    "[data-rp-add]",
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.rpAdd,
          p = t.reflectProposals[i];
        if (p.kind === "done") {
          t.reflectProposals.splice(i, 1);
          if (!dayFor(state.todayDate).targets.some((x) => x.id === p.targetId))
            return render(), toast("That target is no longer in the list.");
          return updateDay(
            (day) => (day.targets.find((x) => x.id === p.targetId).done = p.value),
            `Marked ${p.value ? "done" : "not done"}.`,
          );
        }
        if (!p.kind || !p.value.trim()) return;
        t.reflectProposals.splice(i, 1);
        addItems(p.kind === "learning" ? "learnings" : "nextSteps", [p.value], p.source);
      }),
  );
  each(
    "[data-carry]",
    (b) =>
      (b.onclick = () => {
        const c = carryOver(days(), state.todayDate)[+b.dataset.carry];
        if (c) addTargets([c.value], "carryover");
      }),
  );
  each(
    "[data-target-status]",
    (b) =>
      (b.onclick = () => {
        const value = b.dataset.value === "true";
        updateDay((day) => {
          const target = day.targets.find((x) => x.id === b.dataset.targetStatus);
          // Tapping the selected answer again returns it to "not reviewed".
          if (target) target.done = target.done === value ? null : value;
        });
      }),
  );
  each(
    "[data-target-remove]",
    (b) =>
      (b.onclick = () =>
        updateDay(
          (day) => (day.targets = day.targets.filter((x) => x.id !== b.dataset.targetRemove)),
          "Target removed.",
        )),
  );
  each(
    "[data-item-remove]",
    (b) =>
      (b.onclick = () => {
        const [kind, id] = b.dataset.itemRemove.split(":");
        updateDay((day) => (day[kind] = day[kind].filter((x) => x.id !== id)), "Removed.");
      }),
  );
  each(
    "[data-day]",
    (b) =>
      (b.onclick = () =>
        navigate("today", {
          date: b.dataset.day >= localDate() ? undefined : b.dataset.day,
        })),
  );
  each(
    "[data-notify-on]",
    (el) =>
      (el.onchange = () => {
        data.notifications[el.dataset.notifyOn].on = el.checked;
        persist();
      }),
  );
  each(
    "[data-notify-time]",
    (el) =>
      (el.onchange = () => {
        if (!TIME_RE.test(el.value)) return toast("Choose a time like 08:00.");
        data.notifications[el.dataset.notifyTime].time = el.value;
        if (persist()) toast("Time saved.");
      }),
  );
}

// ---------- Notifications ----------
// Local only: the page checks every 30 seconds while it is open and shows a
// system notification through the service worker (needed on Android) or the
// Notification constructor. No push server is involved.
let swRegistration = null,
  checking = false;
function registerWorker() {
  if (!navigator.serviceWorker || !window.isSecureContext) return;
  try {
    navigator.serviceWorker
      .register("/sw.js")
      .then((r) => (swRegistration = r))
      .catch(() => {});
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "open-today") navigate("today");
    });
  } catch {}
}
async function deliver(n) {
  const options = {
    body: n.body,
    tag: "equilibrium-" + n.type,
    data: { url: "/#/today" },
  };
  try {
    const reg =
      swRegistration || (await navigator.serviceWorker?.getRegistration());
    if (reg) {
      await reg.showNotification(n.title, options);
      return true;
    }
  } catch {}
  try {
    const note = new Notification(n.title, options);
    note.onclick = () => {
      window.focus();
      note.close();
      navigate("today");
    };
    return true;
  } catch {
    return false;
  }
}
async function checkNotifications() {
  if (
    checking ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    !data.notifications.enabled
  )
    return;
  checking = true;
  try {
    const date = localDate(),
      sent = data.notifications.sent[date] || [];
    const due = dueNotifications({
      now: new Date(),
      date,
      day: data.days[date],
      settings: data.notifications,
      sent,
    });
    if (!due.length) return;
    const delivered = [];
    for (const n of due) if (await deliver(n)) delivered.push(n.type);
    if (!delivered.length) return;
    data.notifications.sent = pruneSent(
      mergeSent(data.notifications.sent, { [date]: delivered }),
      date,
    );
    persist();
  } finally {
    checking = false;
  }
}
async function toggleNotifications() {
  if (state.demo) return;
  if (data.notifications.enabled && Notification.permission === "granted") {
    data.notifications.enabled = false;
    if (persist()) toast("Notifications turned off.");
    return render();
  }
  let permission = Notification.permission;
  try {
    if (permission === "default")
      permission = await Notification.requestPermission();
  } catch {}
  if (permission !== "granted") {
    render();
    return toast("Notifications weren’t allowed. You can change this in your browser’s site settings.");
  }
  data.notifications.enabled = true;
  if (persist()) {
    render();
    toast("Notifications are on.");
    checkNotifications();
  }
}

function render() {
  const pages = {
    home,
    history,
    progress,
    learn,
    lesson,
    sos,
    reflect,
    detail,
    privacy,
    today,
  };
  $("#app").innerHTML = layout((pages[state.page] || home)());
  bind();
}
function newReflection() {
  const start = () => {
    state.draft = {
      occurredAt: localDate(),
      responseGoal: state.demo ? "" : data.goal,
      source: "text",
      kind: "incident",
      confirmed: {},
      provenance: {},
      ...(state.page === "sos" && state.sosMode === "saved" && state.linkedSOS
        ? {
            linkedSOS: state.linkedSOS,
            pauseAttempted:
              records().find((r) => r.id === state.linkedSOS)?.pauseAttempted ??
              null,
          }
        : {}),
    };
    state.linkedSOS = null;
    state.proposals = {};
    state.step = 1;
    state.dirty = false;
    cacheDraft();
    navigate("reflect", { step: 1, force: true });
  };
  if (state.page === "reflect" && state.dirty)
    return modal(
      "Start another moment?",
      "The current unsaved draft will be discarded.",
      "Start new",
      start,
    );
  start();
}
function saveDraft(form) {
  if (!form) return true;
  let valid = true;
  for (const [key, value] of new FormData(form)) {
    if (typeof value !== "string") continue;
    try {
      if (["intensity", "recoveryMinutes"].includes(key))
        state.draft[key] = parseNumber(value, key === "intensity" ? 10 : 1440);
      else if (
        [
          "goalMet",
          "recognizedTrigger",
          "pauseAttempted",
          "harmfulBehavior",
          "repairRelevant",
          "repaired",
        ].includes(key)
      )
        state.draft[key] = bool(value);
      else state.draft[key] = value.trim();
    } catch {
      valid = false;
      toast(
        `${key === "intensity" ? "Intensity" : "Recovery"} not saved: use 0–${key === "intensity" ? 10 : 1440}.`,
      );
    }
  }
  cacheDraft();
  return valid;
}
function bind() {
  document.querySelector(".skip").onclick = (e) => {
    e.preventDefault();
    $("#main").focus();
  };
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.nav)));
  bindRows();
  document
    .querySelectorAll("[data-lesson]")
    .forEach(
      (b) => (b.onclick = () => navigate("lesson", { id: b.dataset.lesson })),
    );
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => action(b.dataset.action)));
  document.querySelectorAll("[data-confirm]").forEach(
    (b) =>
      (b.onclick = () => {
        saveDraft($("#reflect-form"));
        const k = b.dataset.confirm,
          p = state.proposals[k],
          input = $("#proposal-" + k);
        if (!input.reportValidity()) return;
        dSet(
          k,
          ["intensity", "recoveryMinutes"].includes(k)
            ? Number(input.value)
            : input.value.trim(),
          p.provenance,
        );
        cacheDraft();
        render();
      }),
  );
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        saveDraft($("#reflect-form"));
        const k = b.dataset.remove;
        delete state.proposals[k];
        delete state.draft[k];
        delete state.draft.confirmed[k];
        state.dirty = true;
        cacheDraft();
        render();
      }),
  );
  document.querySelectorAll("[data-proposal-input]").forEach(
    (input) =>
      (input.oninput = () => {
        const key = input.dataset.proposalInput;
        state.proposals[key].value = input.value;
        state.draft.confirmed[key] = false;
        delete state.draft[key];
        state.dirty = true;
        cacheDraft();
      }),
  );
  if ($("#search"))
    $("#search").oninput = (e) => {
      state.search = e.target.value;
      updateList();
    };
  if ($("#filter"))
    $("#filter").onchange = (e) => {
      state.filter = e.target.value;
      updateList();
    };
  const form = $("#reflect-form");
  if (form) {
    form.oninput = (e) => {
      if (e.target.name) {
        state.dirty = true;
        saveDraft(form);
        if (FIELD_LABELS[e.target.name]) {
          state.draft.confirmed[e.target.name] = true;
          state.draft.provenance[e.target.name] =
            e.target.name === "automaticThought"
              ? "user_interpretation"
              : "user_fact";
        }
        cacheDraft();
      }
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!saveDraft(form)) return;
      if (recognition) {
        recognition.stop();
        recognition = null;
      }
      if (state.step === 1) {
        if (
          !state.draft.narrative &&
          !state.draft.trigger &&
          !state.draft.response
        ) {
          toast("Tell us a little about the moment before continuing.");
          $("#narrative").focus();
          return;
        }
        state.proposals = extractIncidentStub(
          state.draft.narrative || "",
        ).fields;
        state.step = 2;
      } else if (state.step === 2)
        state.step = state.draft.responseGoal ? 4 : 3;
      else if (state.step === 3) state.step = state.draft.responseGoal ? 4 : 5;
      else if (state.step === 4) state.step = 5;
      else if (state.step === 5) state.step = 6;
      else return commitReflection();
      cacheDraft();
      navigate("reflect", { step: state.step });
    };
  }
  if ($("#goal-form"))
    $("#goal-form").onsubmit = (e) => {
      e.preventDefault();
      if (state.demo) return;
      const goal = $("#goal").value.trim(),
        practice = $("#practice").value.trim();
      const save = () => {
        data.goal = goal;
        data.practice = practice;
        if (persist())
          toast(
            goal ? "Practice intention saved." : "Practice intention cleared.",
          );
      };
      if (!goal && data.goal)
        return modal(
          "Clear your practice intention?",
          "Future moments will start without a pre-filled goal.",
          "Clear intention",
          save,
        );
      if (!goal && !practice)
        return toast("Add an intention or rehearsal first.");
      save();
    };
  document
    .querySelectorAll("[data-sos-outcome]")
    .forEach((b) => (b.onclick = () => saveSOS(b.dataset.sosOutcome)));
  if ($("#import-file")) $("#import-file").onchange = importBackup;
  if (state.page === "today") bindToday();
  document
    .querySelectorAll("input[maxlength],textarea[maxlength]")
    .forEach((input) => {
      const count = document.createElement("small");
      count.className = "count";
      count.setAttribute("aria-live", "polite");
      input.after(count);
      const update = () => {
        count.textContent =
          input.value.length >= input.maxLength * 0.8
            ? `${input.value.length.toLocaleString()} / ${input.maxLength.toLocaleString()}`
            : "";
      };
      input.addEventListener("input", update);
      input.addEventListener("paste", (e) => {
        const text = e.clipboardData?.getData("text") || "";
        if (
          input.value.length -
            (input.selectionEnd - input.selectionStart) +
            text.length >
          input.maxLength
        )
          setTimeout(() => {
            count.textContent = `Limit reached: ${input.maxLength.toLocaleString()} characters. Extra text was not kept.`;
          }, 0);
      });
      update();
    });
}
const TODAY_ACTIONS = new Set([
  "voice-targets",
  "voice-reflect",
  "suggest-targets",
  "add-targets-raw",
  "add-all-targets",
  "sort-reflection",
  "add-learning-raw",
  "add-next-raw",
  "notify-toggle",
  "notify-test",
]);
function action(a) {
  if (TODAY_ACTIONS.has(a)) return todayAction(a);
  if (a === "new") return newReflection();
  if (a === "toggle-demo") {
    const change = () => {
      clearDraft();
      state.demo = !state.demo;
      try {
        sessionStorage.setItem("equilibrium.demo", String(state.demo));
      } catch {}
      state.search = "";
      state.filter = "";
      navigate(
        ["reflect", "detail"].includes(state.page) ? "history" : state.page,
        { force: true },
      );
    };
    if (state.page === "reflect" && state.dirty)
      return modal(
        "Switch workspace?",
        "Your unsaved draft will be discarded.",
        "Switch",
        change,
      );
    return change();
  }
  if (a === "checkin") {
    if (state.demo) return;
    if (!data.checkins.includes(localDate())) data.checkins.push(localDate());
    if (persist()) {
      render();
      toast("Daily check-in saved.");
    }
    return;
  }
  if (a === "cancel-reflect") {
    const target = state.draft?.id;
    return navigate(target ? "detail" : "home", { id: target });
  }
  if (a === "back-step") {
    const valid = saveDraft($("#reflect-form"));
    state.step =
      state.step === 6
        ? 5
        : state.step === 5
          ? state.draft.responseGoal
            ? 4
            : 3
          : state.step - 1;
    cacheDraft();
    navigate("reflect", { step: state.step });
    if (!valid)
      toast(
        "Invalid number not saved. Intensity: 0–10; recovery: 0–1440 minutes.",
      );
    return;
  }
  if (a === "skip-question") {
    const key =
      state.step === 3
        ? "responseGoal"
        : state.step === 4
          ? "goalMet"
          : "pauseAttempted";
    state.draft[key] = key === "responseGoal" ? "" : null;
    state.dirty = true;
    state.step = state.step === 3 ? 5 : state.step + 1;
    cacheDraft();
    navigate("reflect", { step: state.step });
    return;
  }
  if (a === "edit") {
    const r = records().find((r) => r.id === state.detail);
    state.draft = {
      ...r,
      confirmed: { ...r.confirmed },
      provenance: { ...r.provenance },
      tagsText: (r.tags || []).join(", "),
    };
    state.proposals = {};
    state.step = 6;
    state.dirty = false;
    cacheDraft();
    navigate("reflect", { step: 6 });
    return;
  }
  if (a === "delete")
    return modal(
      "Delete this moment?",
      "This removes the moment and updates your progress. It cannot be undone.",
      "Delete",
      () => {
        if (state.demo)
          state.samples = state.samples.filter((r) => r.id !== state.detail);
        else {
          data.records = data.records.filter((r) => r.id !== state.detail);
          persist();
        }
        navigate("history");
        toast("Moment deleted.");
      },
      true,
    );
  if (a === "script-next" || a === "script-prev") {
    state.script = ((state.script || 0) + (a === "script-next" ? 1 : 2)) % 3;
    render();
    return;
  }
  if (a === "ground") {
    stopBreathing();
    state.sosMode = "grounding";
    state.groundStep = 0;
    render();
    document.querySelector(".exercise")?.scrollIntoView({ block: "center" });
    return;
  }
  if (a === "ground-next") {
    if (state.groundStep === 4) {
      state.sosMode = "idle";
      render();
      toast("Grounding complete. Choose your next step.");
    } else {
      state.groundStep++;
      render();
    }
    return;
  }
  if (a === "breathe" || a === "away") return startExercise(a);
  if (a === "sos-stop") {
    stopBreathing();
    state.sosMode = "idle";
    render();
    return;
  }
  if (a === "sos-done") {
    stopBreathing();
    state.sosMode = "outcome";
    render();
    return;
  }
  if (a === "expand-story") {
    const p = $("#story-text"),
      button = document.querySelector('[data-action="expand-story"]');
    const expanded = p.classList.toggle("clamped") === false;
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "Show less" : "Show full story";
    return;
  }
  if (a === "intro") return showIntro();
  if (a === "use-practice") {
    if (state.demo) return;
    data.goal = lessons[state.lesson].prompt;
    if (persist()) {
      navigate("learn");
      toast("Practice intention saved.");
    }
    return;
  }
  if (a === "export") {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), ...data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `equilibrium-${localDate()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Personal data export downloaded.");
    return;
  }
  if (a === "clear")
    return modal(
      "Delete all personal data?",
      "Export a copy first if you need one. This clears personal moments, check-ins, practice notes, daily targets, learnings, next steps and notification settings from this browser.",
      "Delete all",
      () => {
        try {
          localStorage.removeItem(STORAGE);
          clearDraft();
          data = { ...freshData(), onboarded: true };
          persist();
          render();
          toast("Personal data deleted.");
        } catch {
          toast("Could not clear browser storage.");
        }
      },
      true,
    );
  if (a === "voice")
    return voice({
      field: "narrative",
      label: "voice-label",
      onText: (text) => {
        state.draft.narrative = text;
        state.draft.source = "voice";
        state.dirty = true;
        cacheDraft();
      },
    });
}
// Browser speech recognition, written into a textarea. Consent is asked every
// time. `onText` receives the final (not interim) transcript so far.
function voice({
  field,
  label = field + "-voice",
  idle = "Tap to speak",
  consent = "Your browser may send audio to its speech provider. Equilibrium stores no audio. Only words you review and save become a reflection.",
  onText,
}) {
  if (recognition) {
    recognition.stop();
    return;
  }
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) {
    toast("Voice is unavailable in this browser. You can type instead.");
    $("#" + field)?.focus();
    return;
  }
  const setLabel = (text, on) => {
    const el = $("#" + label);
    if (el) el.textContent = text;
    el?.closest("button")?.classList.toggle("listening", on);
  };
  const start = () => {
    const el = $("#" + field);
    if (!el) return;
    const max = el.maxLength > 0 ? el.maxLength : 10000;
    recognition = new Speech();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    let finalText = el.value;
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += (finalText ? " " : "") + text;
        else interim += text;
      }
      const target = $("#" + field);
      if (target) {
        target.value = (finalText + " " + interim).trim().slice(0, max);
        onText(finalText.slice(0, max));
      }
    };
    recognition.onerror = () =>
      toast("Voice capture stopped. Continue by typing.");
    recognition.onend = () => {
      recognition = null;
      state.listening = null;
      setLabel(idle, false);
    };
    try {
      recognition.start();
      state.listening = field;
      setLabel("Listening · tap to stop", true);
    } catch {
      recognition = null;
      toast("Could not start voice. You can type instead.");
    }
  };
  modal(
    "Use your browser’s voice service?",
    consent,
    "Start voice capture",
    start,
  );
}
window.addEventListener("beforeunload", (e) => {
  if (state.page === "reflect" && state.dirty) {
    cacheDraft();
    e.preventDefault();
    e.returnValue = "";
  }
});
let toastTimer = null,
  lastHash = "",
  draftTimer = null;
const answer = (v) =>
  v === true ? "Yes" : v === false ? "No" : "Not answered";
function segments(yes, no, unknown) {
  const all = yes + no + unknown;
  if (!all) return '<div class="seg empty-seg" aria-hidden="true"></div>';
  const buckets = [
    ["y", yes],
    ["n", no],
    ["u", unknown],
  ];
  return `<div class="seg" aria-hidden="true">${buckets.flatMap(([cls, count]) => Array.from({ length: Math.round((count / all) * 100) }, () => `<i class="${cls}"></i>`)).join("")}</div>`;
}
function provenance(type) {
  return `<span class="prov ${type === "local_suggestion" ? "suggestion" : type === "user_interpretation" ? "interpretation" : "fact"}">${type === "local_suggestion" ? "Local suggestion" : type === "user_interpretation" ? "Your interpretation" : "You said"}</span>`;
}
function choices(key) {
  return `<fieldset class="choice-stack"><legend class="sr-only">Choose an answer</legend>${[
    ["yes", "Yes"],
    ["no", "No"],
    ["unknown", "Not sure"],
  ]
    .map(
      ([v, label]) =>
        `<label class="choice"><input type="radio" name="${key}" value="${v}" ${(state.draft[key] === true && v === "yes") || (state.draft[key] === false && v === "no") ? "checked" : ""}>${label}</label>`,
    )
    .join("")}</fieldset>`;
}
function dSet(key, value, source = "user_fact") {
  state.draft[key] = value;
  state.draft.confirmed[key] = true;
  state.draft.provenance[key] = source;
  state.dirty = true;
}
function cacheDraft() {
  try {
    sessionStorage.setItem(
      "equilibrium.draft.v1",
      JSON.stringify({
        draft: state.draft,
        proposals: state.proposals,
        dirty: state.dirty,
        demo: state.demo,
      }),
    );
  } catch {
    toast("Draft recovery is unavailable in this browser.");
  }
}
function clearDraft() {
  state.draft = null;
  state.dirty = false;
  state.proposals = {};
  try {
    sessionStorage.removeItem("equilibrium.draft.v1");
  } catch {}
}
function bindRows() {
  document
    .querySelectorAll("[data-open]")
    .forEach(
      (b) => (b.onclick = () => navigate("detail", { id: b.dataset.open })),
    );
}
function updateList() {
  const filtered = sorted().filter(
    (r) =>
      (!state.filter || r.emotion === state.filter) &&
      [r.title, r.narrative, r.trigger, r.context, ...(r.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(state.search.toLowerCase()),
  );
  $("#history-list").innerHTML = filtered.length
    ? filtered.map(row).join("")
    : '<div class="empty"><h3>No matching moments</h3><p>Try another word or emotion.</p></div>';
  bindRows();
}
function applyRoute() {
  stopBreathing();
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  $("#toast").classList.remove("show");
  const route = parseRoute(location.hash);
  state.page = route.page;
  if (route.page === "detail") {
    state.detail = route.id;
    if (!records().some((r) => r.id === route.id)) {
      state.page = "history";
      window.history.replaceState(null, "", toHash({ page: "history" }));
      setTimeout(() => toast("That reflection no longer exists."), 0);
    }
  }
  if (route.page === "lesson") {
    state.lesson = lessons[route.id] ? route.id : "pause";
  }
  if (route.page === "reflect") {
    if (state.draft && (state.draft.id || null) !== (route.id || null))
      clearDraft();
    if (!state.draft) {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("equilibrium.draft.v1"),
        );
        if (
          saved?.draft &&
          saved.demo === state.demo &&
          (saved.draft.id || null) === (route.id || null)
        ) {
          state.draft = saved.draft;
          state.proposals = saved.proposals || {};
          state.dirty = saved.dirty;
        }
      } catch {}
    }
    if (!state.draft) {
      const r = route.id ? records().find((r) => r.id === route.id) : null;
      state.draft = r
        ? {
            ...r,
            tagsText: (r.tags || []).join(", "),
            confirmed: { ...r.confirmed },
            provenance: { ...r.provenance },
          }
        : {
            occurredAt: localDate(),
            responseGoal: state.demo ? "" : data.goal,
            confirmed: {},
            provenance: {},
            source: "text",
            kind: "incident",
          };
      state.proposals = {};
      state.dirty = false;
    }
    state.step = route.step;
    if (state.step === 4 && !state.draft.responseGoal) state.step = 3;
  }
  if (route.page === "sos" && !["saved", "outcome"].includes(state.sosMode))
    state.sosMode = "idle";
  if (route.page === "today") {
    const date =
      route.date && route.date <= localDate() ? route.date : localDate();
    if (route.date && date !== route.date)
      window.history.replaceState(null, "", toHash({ page: "today" }));
    // Suggestions are tied to one day's targets; unsent text is kept.
    if (state.today.date !== date) {
      state.today.targetProposals = [];
      state.today.reflectProposals = [];
      state.today.date = date;
    }
    state.todayDate = date;
  }
  lastHash = location.hash;
  render();
  window.scrollTo(0, 0);
  $("#main").focus({ preventScroll: true });
}
function commitReflection() {
  const d = state.draft;
  if (!d.narrative && !d.trigger && !d.response) {
    state.step = 1;
    navigate("reflect", { step: 1 });
    toast("Add a little about what happened first.");
    return;
  }
  if (!d.responseGoal) d.goalMet = null;
  if (d.repairRelevant !== true) d.repaired = null;
  const r = migrateRecord({
    ...d,
    id: d.id || makeId(),
    createdAt: d.createdAt || new Date().toISOString(),
    tags: (d.tagsText || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  delete r.tagsText;
  for (const key of Object.keys(FIELD_LABELS)) {
    if (r[key] != null && r[key] !== "") {
      r.provenance[key] ??=
        key === "automaticThought" ? "user_interpretation" : "user_fact";
      r.confirmed[key] = true;
    }
  }
  const previous = records().slice();
  const index = records().findIndex((v) => v.id === r.id);
  if (index >= 0) records()[index] = r;
  else records().push(r);
  if (!state.demo && !persist()) {
    data.records = previous;
    return;
  }
  clearDraft();
  window.history.replaceState(null, "", toHash({ page: "history" }));
  navigate("detail", { id: r.id, force: true });
  toast(
    state.demo
      ? "Sample moment saved for this session."
      : "Your moment is saved.",
  );
}
function startExercise(type) {
  stopBreathing();
  state.sosMode = type === "breathe" ? "breathing" : "away";
  render();
  document.querySelector(".exercise")?.scrollIntoView({ block: "center" });
  const duration = type === "breathe" ? 60 : 600,
    end = Date.now() + duration * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const label = $("#exercise-label"),
      timer = $("#exercise-timer");
    if (!label || !timer) return stopBreathing();
    if (!left) {
      stopBreathing();
      label.textContent = "Done. Choose your next step.";
      timer.textContent = "Take your time.";
      return;
    }
    label.textContent =
      type === "breathe"
        ? (duration - left) % 10 < 4
          ? "Breathe in, gently"
          : "Breathe out, gently"
        : "Give yourself some space";
    timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} remaining`;
  };
  tick();
  breathing = setInterval(tick, 1000);
}
function saveSOS(outcome) {
  const r = migrateRecord({
    id: makeId(),
    createdAt: new Date().toISOString(),
    occurredAt: localDate(),
    title: "A moment to pause",
    source: "sos",
    kind: "sos",
    pauseAttempted: outcome === "paused" ? true : null,
    harmfulBehavior: outcome === "regret" ? true : null,
    goalMet: null,
    responseGoal: "",
    narrative:
      outcome === "paused"
        ? "I paused before responding."
        : outcome === "regret"
          ? "I said something I regret."
          : "Still in it; outcome not reported.",
    tags: [],
  });
  records().push(r);
  if (!state.demo && !persist()) {
    data.records.pop();
    return;
  }
  state.linkedSOS = r.id;
  state.sosMode = "saved";
  render();
}
function showIntro() {
  const dialog = $("#dialog");
  dialog.innerHTML = `<div class="eyebrow">WELCOME TO EQUILIBRIUM</div><h2>A little space between feeling and acting.</h2><p><strong>In the moment:</strong> SOS helps you pause.<br><strong>Afterwards:</strong> capture a moment and reflect.</p><h3>Your words stay in this browser.</h3><p>Text is stored locally, not app-encrypted or synced. You can export a backup anytime. Voice uses your browser’s speech service, which may process audio remotely.</p><h3>A reflection companion.</h3><p>Not therapy or diagnosis. In immediate danger, contact local emergency services or a trusted person.</p><div class="actions"><button class="btn secondary" id="intro-demo">Try sample data</button><button class="btn" id="intro-start">Start</button></div>`;
  dialog.showModal();
  const finish = () => {
    data.onboarded = true;
    persist();
    dialog.close();
    dialog.oncancel = null;
  };
  $("#intro-start").onclick = finish;
  $("#intro-demo").onclick = () => {
    finish();
    if (!state.demo) action("toggle-demo");
  };
  dialog.oncancel = () => {
    data.onboarded = true;
    persist();
  };
}
async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw Error("Use a backup smaller than 5 MB.");
    const incoming = JSON.parse(await file.text());
    if (
      incoming.version !== 1 ||
      !Array.isArray(incoming.records) ||
      !Array.isArray(incoming.checkins)
    )
      throw Error("Choose an Equilibrium JSON export.");
    for (const r of incoming.records) {
      if (
        !r ||
        typeof r.id !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.occurredAt) ||
        typeof r.createdAt !== "string" ||
        (r.tags != null &&
          (!Array.isArray(r.tags) || r.tags.some((t) => typeof t !== "string")))
      )
        throw Error("This backup contains an invalid record.");
      for (const k of ["intensity", "recoveryMinutes"])
        if (
          r[k] != null &&
          (typeof r[k] !== "number" || !Number.isFinite(r[k]) || r[k] < 0)
        )
          throw Error("This backup contains invalid numbers.");
      for (const k of [
        "narrative",
        "title",
        "context",
        "trigger",
        "response",
        "emotion",
        "responseGoal",
        "regulationAttempt",
      ])
        if (r[k] != null && typeof r[k] !== "string")
          throw Error("This backup contains an invalid field.");
    }
    if (
      incoming.checkins.some(
        (d) => typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d),
      )
    )
      throw Error("Invalid check-in dates.");
    const incomingDays = validateDays(incoming.days);
    const dayCount = Object.keys(incomingDays).length;
    modal(
      "Import this backup?",
      `Merge ${incoming.records.length} moments${dayCount ? ` and ${plural(dayCount, "day")} of targets and reflections` : ""}. Existing moments and items with the same ID will be kept. Existing practice notes stay; empty notes are filled from the backup. Notification settings are not changed.`,
      "Merge backup",
      () => {
        const ids = new Set(data.records.map((r) => r.id));
        data.records.push(
          ...incoming.records.filter((r) => !ids.has(r.id)).map(migrateRecord),
        );
        data.checkins = [...new Set([...data.checkins, ...incoming.checkins])];
        data.days = mergeDays(data.days, incomingDays);
        if (!data.goal && typeof incoming.goal === "string")
          data.goal = incoming.goal;
        if (!data.practice && typeof incoming.practice === "string")
          data.practice = incoming.practice;
        if (persist()) {
          render();
          toast("Backup imported.");
        }
      },
    );
  } catch (error) {
    toast(error.message || "Could not read backup.");
  }
  e.target.value = "";
}

window.addEventListener("hashchange", () => {
  const target = location.hash;
  if (
    state.page === "reflect" &&
    state.dirty &&
    parseRoute(target).page !== "reflect"
  ) {
    window.history.replaceState(null, "", lastHash);
    modal(
      "Leave this reflection?",
      "Your unsaved draft will be discarded.",
      "Discard draft",
      () => {
        clearDraft();
        window.history.pushState(null, "", target);
        applyRoute();
      },
    );
  } else applyRoute();
});
if (!location.hash) window.history.replaceState(null, "", "#/home");
applyRoute();
if (!data.onboarded) showIntro();
// Another tab saved: reload so this tab never writes stale data over it.
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE || e.newValue == null) return;
  try {
    const saved = JSON.parse(e.newValue);
    if (!saved || !Array.isArray(saved.records) || !Array.isArray(saved.checkins))
      return;
    data = loadData(saved);
    if (
      state.page !== "reflect" &&
      !document.activeElement?.matches("input, textarea, select") &&
      !$("#dialog").open
    )
      render();
  } catch {}
});
setInterval(() => {
  // Roll the Today page over at midnight.
  if (
    state.page === "today" &&
    !parseRoute(location.hash).date &&
    state.todayDate !== localDate()
  )
    applyRoute();
  checkNotifications();
}, 30_000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkNotifications();
});
registerWorker();
checkNotifications();

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
