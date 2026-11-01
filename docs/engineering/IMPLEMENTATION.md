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

## Deferred from the broader handoff

Remote extraction/model selection, automated safety classification and evaluation, region-specific crisis resources and call actions, four-week evidence-threshold trends, reminder notifications, role-play, full per-field focus when using timeline Add, and formal accessibility/usability audits.
