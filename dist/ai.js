// Conservative, local-only suggestions. No model, network, or diagnostic claims.
const allowed = [
  "trigger",
  "response",
  "automaticThought",
  "emotion",
  "physicalCues",
  "context",
  "intensity",
  "recoveryMinutes",
];
export function extractIncidentStub(text) {
  const fields = {};
  const add = (key, value, quote, provenance = "user_fact") => {
    if (!fields[key]) fields[key] = { value, provenance, evidence: quote };
  };
  const sentences = text.match(/[^.!?\n]+[.!?]?/g) || [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (/\b(?:they|he|she|\w+) said\b/i.test(s) && !/\bi said\b/i.test(s))
      add("trigger", s, s);
    if (/\bi (?:said|yelled|interrupted|cut|walked|asked|paused)\b/i.test(s))
      add("response", s, s);
    if (/\bi (?:thought|think)|felt like (?:they|he|she)/i.test(s))
      add("automaticThought", s, s, "user_interpretation");
    if (
      /\b(?:jaw|face (?:went )?hot|heart racing|fists|tight chest)\b/i.test(s)
    )
      add("physicalCues", s, s);
  }
  const emotion = text.match(
    /\b(angry|frustrated|anxious|hurt|embarrassed|disappointed|overwhelmed|sad|calm|annoyed)\b/i,
  );
  if (emotion)
    add(
      "emotion",
      emotion[0].toLowerCase() === "annoyed"
        ? "Frustrated"
        : emotion[0][0].toUpperCase() + emotion[0].slice(1).toLowerCase(),
      emotion[0],
      "local_suggestion",
    );
  const intensity = text.match(/\b(10|[0-9])\s*(?:out of|\/)\s*10\b/i);
  if (intensity) add("intensity", Number(intensity[1]), intensity[0]);
  const recovery = text.match(
    /(?:recover(?:ed|y)?|calm(?:ed)? down|back to (?:normal|baseline))[^.!?\n]{0,30}?(\d+)\s*minutes?/i,
  );
  if (recovery && Number(recovery[1]) <= 1440)
    add(
      "recoveryMinutes",
      Number(recovery[1]),
      recovery[0],
      "local_suggestion",
    );
  const hour = text.match(
    /(?:annoyed|upset|angry|recover\w*)[^.!?\n]{0,25}(?:an|one) hour/i,
  );
  if (hour) add("recoveryMinutes", 60, hour[0], "local_suggestion");
  const context = text.match(/\b(meeting|work|partner|home|sprint review)\b/i);
  if (context) add("context", context[0], context[0], "local_suggestion");
  return {
    fields,
    notMentioned: allowed.filter((k) => !fields[k]),
    engine: "local rules",
  };
}
