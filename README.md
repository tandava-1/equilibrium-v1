# Equilibrium

Mobile-first local reflection app, updated from the Equilibrium UX handoff and its capture, SOS and progress mockups.

## Run

Requires Node.js 18+. No packages, account or API key required.

```sh
git clone https://github.com/tandava-1/equilibrium-v1.git
cd equilibrium-v1
npm start
```

Open http://127.0.0.1:4173. Keep the terminal running. Ctrl+C stops the server.

```sh
npm test
```

## Implemented UX

- Prominent “I’m triggered” entry; SOS scripts first, with script navigation, one-minute breathing, five-step grounding, ten-minute step-away timer, visible emergency guidance and optional outcome capture.
- Voice-or-type capture; conservative local text rules propose fields with evidence and provenance. Each proposal requires confirmation; unaccepted fields remain absent.
- Up to three short follow-up screens for goal, goal alignment and pause, followed by a full review and optional editor.
- Hash routes support Back/Forward and reload. Unsaved drafts recover from sessionStorage. Only changed drafts prompt before leaving.
- Story timeline for saved moments, consistent titles/dates, preserved paragraph breaks and expandable long narratives.
- Completeness strip, constructive-response emphasis, count-first metrics, missingness breakdown and median recovery with range.
- First-run introduction, replayable from Privacy; sticky sample banner and sample markers.
- Export and validated JSON import, merged by ID without overwriting existing records.
- Mobile-first bottom navigation and touch targets. From 960px, a sidebar and wider review layout use laptop space.
- Higher-contrast labels, non-intercepting toasts, static detail actions and reserved space for SOS help.

## Data and limitations

Personal data remains in this browser/origin's localStorage, under `equilibrium.local.v1`, with schemaVersion 2. Existing records are migrated in memory without losing original fields. Drafts use sessionStorage (`equilibrium.draft.v1`) and clear on save/discard. Both stores are unencrypted by this app; they are not synced or backed up. Export before clearing browser data. Sensitive drafts can remain until discarded or the browser session ends.

Voice uses browser SpeechRecognition, with explicit consent each time. Its provider may process audio remotely. Equilibrium never stores audio. Typed capture and local suggestions make no network requests. Local rules are not a live AI model and can miss or misinterpret language; confirmation remains essential.

No remote AI, account system, diagnosis, automated crisis detection, notifications, or clinical evaluation is included. Emergency guidance is visible but has no region-specific phone number or callable hotline pending region/resource configuration. The app must not be relied upon to detect or manage emergencies.

## Metrics

Constructive-response rate uses incidents with a response goal and explicit yes/no alignment; no-goal and unanswered counts are separate. SOS-only records are excluded from that rate. Pause counts use explicit user reports; entering SOS never automatically establishes a successful pause. When an SOS session is expanded into an incident, the original linked SOS record is excluded from weekly counts to avoid double counting. Recovery input accepts 0–1440 minutes; the display uses median and range. Historical larger values are retained rather than silently deleted. Repair reports relevance unknown separately from outcome unknown. No “Partly” option is included pending its definition.

## Verification

16 node:test cases cover missingness, zero recovery, medians, relevance, North Star eligibility, routes, migration, local extraction, date windows and SOS deduplication. Browser checks exercised phone capture/confirmation/follow-ups/save, draft reload, browser Back, SOS grounding/breathing/outcomes, and phone/desktop progress. Microphone audio capture and real device phone calling were not tested. No automated accessibility audit or pilot usability study was run.

## Source

`dist/` is the source; there is no build step. `app.js` handles UI; `model.js` contains data and route helpers; `ai.js` is the local rule-based extractor (despite its integration-oriented filename). `styles.css` contains responsive design. `server.mjs` serves on loopback only and restricts assets and scripts to the same origin.

## Network access

The development server defaults to loopback. Use `HOST=0.0.0.0 npm start` only when you want other devices on your local network to reach it. Hosted deployments serve the files in `dist/` over HTTPS. Browser data does not automatically move between local and hosted origins; use export/import.
