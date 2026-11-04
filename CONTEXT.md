# Equilibrium — Context

## Current state

_Last updated 2026-11-04 08:09 IST by Claude Code · cloud session_

**What it is.** A local-only reflection app for noticing and handling
triggered moments. An "I'm triggered" SOS entry (scripts, one-minute
breathing, five-step grounding, a ten-minute step-away timer, visible
emergency guidance), voice-or-type capture where conservative local rules
propose fields that the user must confirm, short follow-ups on goal and
pause, a story timeline, progress metrics that count missing data openly,
and JSON export/import. No account, no API key, no remote AI.

**Today tab** (added 2026-11-04, branch `feat/today-targets`): daily targets
in the morning, learnings and next steps at night, by voice or typing. Local
rules (`dist/daily.js`) split spoken lists and sort evening speech; every
suggestion is confirmed. Optional local notifications: daily quote/mindfulness
message, a target reminder if none added, an evening reminder if learnings or
next steps are missing. Web notifications only arrive while a tab is open
(no push server by design); reliable closed-app reminders need the native iOS
app's local notifications.

Two front ends:
- **Web** (`dist/`, hand-written, no build step), served by `server.mjs` on
  loopback at http://127.0.0.1:4173 (`npm start`). Data lives in the browser's
  localStorage (`equilibrium.local.v1`, schema version 2), unencrypted.
- **Native iOS** (`ios/`, SwiftUI, iOS 17+), built on 2026-10-17 while the repo was in `~/Codex`.
  Simulator tests pass; physical device and TestFlight untested. **Not yet
  committed** (see below).

GitHub: `tandava-1/equilibrium-v1` (private). Built in
`~/Codex/equilibrium-v1`; moved to `~/Claude/equilibrium-v1` on 2026-10-31.
`~/Claude/_archive/equilibrium` is an older no-remote copy (1 local commit,
"Update Site source", 2026-10-15).

**Branches.** Local is on `feat/equilibrium-mobile-mvp` at the MVP commit.
That branch was merged as PR #1, and the nightly review's PR #2 then removed
some dead code on `main`. So `origin/main` is 4 commits ahead of this branch,
and local `main` is stale at the initial commit.

**Uncommitted work.** 2 items, left in place: the whole `ios/` folder
(untracked) and a 4-line addition to `README.md` pointing at it.

**Folder map.**

```
equilibrium-v1/
├── CONTEXT.md, AGENTS.md, CLAUDE.md, README.md
├── dist/          the web app source: app.js (UI), model.js (data, routes),
│                  ai.js (local rule-based extractor, not AI), styles.css,
│                  daily.js (Today tab logic), messages.js, sw.js
├── server.mjs     loopback static server with strict CSP
├── tests/         node:test suites (36 cases)
├── ios/           SwiftUI app + XcodeGen project.yml (uncommitted)
├── docs/
│   ├── engineering/IMPLEMENTATION.md   schema v2 and the UX decisions applied
│   ├── product/   empty
│   └── design/    empty
└── .github/workflows/test.yml   npm test + syntax check on PRs and main
```

**Done.** Web MVP from the UX handoff and three concept mockups (capture,
SOS, progress), schema v2 with provenance and confirmation, 16 tests, CI.
Native iOS first version (not committed).

**Deliberately out.** Remote extraction or model choice, automated safety
classification, region-specific crisis numbers and call actions, four-week
trend thresholds, push notifications via a server, role-play, formal accessibility and usability
audits. The app must not be relied on to detect or manage emergencies.

**Open questions.**
- Commit the iOS app on a fresh branch from `origin/main` (rather than on the
  already-merged `feat/equilibrium-mobile-mvp`) and open a PR?
- Nightly review flagged, not fixed: backup import doesn't dedupe IDs within
  one file; `app.js` (about 1,340 lines) has no tests beyond a syntax check.
- What "Partly" should mean for goal alignment (left out until defined).
- Which region's crisis resources to show.
- The UX handoff and mockups the build was based on aren't in the repo; they
  would belong in `docs/design/`.

- Should the Today tab also come to the iOS app? That is where reminders can
  arrive with the app closed (UNUserNotificationCenter, still no server).
- Real microphone and real OS notification display are untested for the
  Today tab (headless browser can do neither).

**Next.** Review and merge `feat/today-targets`; try it on a real browser with
the mic and notifications; land the iOS app via a new branch and PR; fix the
import dedupe.

## Log

### 2026-10-15 — reconstructed
**Changed:** Repo initialised; Codex's mobile-first web MVP added on
`feat/equilibrium-mobile-mvp` and merged as PR #1.
**Decided:** Local-only. Local suggestions are labelled "Local suggestion",
never "AI". Voice consent is asked every time. Unanswered is never coerced to
false.

### 2026-10-17 — reconstructed
**Changed:** Native SwiftUI companion built in `ios/` (left uncommitted).
Nightly review PR #2 removed unused helpers and a dead metric on `main`
(merged 2026-10-19).

### 2026-10-31 — reconstructed
**Changed:** Moved from `~/Codex/equilibrium-v1` to `~/Claude/equilibrium-v1`.
The older no-remote copy went to `~/Claude/_archive/equilibrium`.

### 2026-11-01 06:53 IST — Claude Code (Opus 5.5) · Shivank's Mac mini
**Changed:** Added CONTEXT.md, AGENTS.md and a one-line CLAUDE.md. Moved
`IMPLEMENTATION.md` to `docs/engineering/` (nothing referenced its path) and
created empty `docs/product/` and `docs/design/`. Fetched `origin` to see the
branch state. The uncommitted `ios/` folder and README change were left
alone.
**Decided:** Committed on the current branch as asked, even though it is
already merged; these files will need to reach `main` with the iOS work.
**Next:** See "Next" above.

### 2026-11-04 08:09 IST — Claude Code · cloud session
**Changed:** Added the Today tab: `dist/daily.js` (target splitting,
reflection sorting, target matching, carry-over, message rotation,
notification timing, backup validate/merge), `dist/messages.js`,
`dist/sw.js` (notification clicks only), UI in `app.js`, styles, `#/today`
routes, 20 new tests. Refactored `voice()` to serve any textarea. Added a
`storage` listener so tabs reload each other's saves. Export/import/clear
cover daily entries.
**Decided:** Built inside Equilibrium rather than as a separate app, since it
shares the local-only rules, storage and voice consent. Web notifications are
page-scheduled with a 3-hour late window, and carry no personal text.
Unreviewed targets stay null and are never carried over as "not done".
Typed lines can be added as written; only extracted splits need confirmation.
**Next:** See "Next" above.
