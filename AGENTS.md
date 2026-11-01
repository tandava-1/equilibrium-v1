# Working on Equilibrium

Read `CONTEXT.md` before starting. Its "Current state" section is where the
project stands; its log is how it got there. Update both as you work, following
the global rules for CONTEXT.md and commits.

Equilibrium is a local-only reflection app for triggered moments: a web app in
`dist/` and a native SwiftUI app in `ios/`.

## Rules

- Local-only. No network requests from typed capture or suggestions, no
  account, no remote AI, no analytics. Personal entries never leave the device
  except through the user's own export.
- Every extracted value is a proposal the user must confirm; unaccepted fields
  stay absent. Call them "Local suggestion", never "AI suggestion".
- Never coerce empty or unanswered to false or zero, and keep zero as a real
  value.
- No automated crisis detection, diagnosis, unverified phone numbers or
  simulated emergency features. General emergency guidance stays visible.
- `dist/` is hand-written source, not build output. `ai.js` is a rule-based
  extractor despite its name.
- After editing `ios/project.yml`, regenerate the Xcode project with XcodeGen.
- Run `npm test` before committing; CI runs it on every PR.
