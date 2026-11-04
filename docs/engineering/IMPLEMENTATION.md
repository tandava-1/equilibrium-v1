# Equilibrium UX implementation

Based on the supplied UX handoff and three concept mockups. The user's existing local-only constraint remains in effect.

## Schema version 2

Existing incident fields are retained. Added: schemaVersion, source (text, voice, sos), kind (incident, sos), provenance (user_fact, user_interpretation, local_suggestion), confirmed, optional linkedSOS. Original narrative is preserved. Unconfirmed extracted values live only in the session draft's proposals, not in the saved incident.

Dates use local calendar days. Numeric inputs preserve zero. Intensity is optional 0–10; recovery is optional 0–1440 minutes. A response without a goal cannot receive a goal alignment score. Repair outcomes are not applicable if repair is explicitly irrelevant. Empty/unanswered is never coerced to false.

## Design decisions applied

- Phone-first design with adaptive desktop from 960px; proposed to the owner via the in-chat question.
- SOS label and prominent “I’m triggered” home entry.
- Local suggestions explicitly say “Local suggestion”, never “AI suggestion”; no external provider configured.
- Voice consent remains per use, rather than silently recording after a previous permission.
- Three focused optional questions, then full review/editor. Extra awareness/repair fields remain optional in the editor.
- No-goal and SOS-only records excluded from goal rate; no Partly option. Linked SOS records are counted once after expansion.
- Median recovery with the handoff's 24-hour input cap, without destroying historic values.
- Backup imports merge by ID and preserve existing practice settings; empty practice settings may be populated.
- General emergency guidance remains visible. No unverified numbers, automated risk screening or simulated emergency capabilities.

## Today tab (added 2026-11-04)

Data: `days[date] = { date, targets: [{ id, text, source, createdAt, done }], learnings: [{ id, text, source, createdAt }], nextSteps: [...] }`. `done` is `true`, `false` or `null`; null means not reviewed and is never counted as not done (carry-over ignores it). `notifications = { enabled, quote|targets|reflection: { on, time }, sent: { date: [types] } }`; the sent log keeps 14 days.

- `splitTargets` splits on punctuation, new lines and spoken separators ("then", "also", "next one", "number two"…). "and" or "," only splits when an action verb follows, so "research and write the spec" stays one target. Lead-ins ("today I want to…") are removed.
- `sortReflection` cuts unpunctuated speech at cue phrases, then labels each clause learning, next step, target review (done / not done, matched when at least half the target's meaningful words appear) or unsorted. Unsorted clauses require the user to choose a kind.
- Typed text can also be added as written (one item per line); that path has no extraction, so it needs no confirmation step.
- Daily message for day n is `messages[(n × stride) mod N]` with stride coprime to N, so all N appear once per N days in a scattered order.
- Notifications: `dueNotifications` is pure and tested. The page checks every 30 s and on becoming visible, delivers via the service worker (needed on Android) or `new Notification`, then records the type for the day. 3-hour late window. A `storage` listener reloads data when another tab saves, so a background tab cannot write stale data over newer entries.

## Deferred from the broader handoff

Remote extraction/model selection, automated safety classification and evaluation, region-specific crisis resources and call actions, four-week evidence-threshold trends, push notifications that arrive while the app is closed (native iOS local notifications are the planned route), role-play, full per-field focus when using timeline Add, and formal accessibility/usability audits.
