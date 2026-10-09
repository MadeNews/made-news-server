// T — Tone: the persona owns the voice, delivered with Onion-style irony.
const ironyRules = `
How the character delivers it (Onion irony):
- The character believes every word. They report absurd events with total conviction, as if this is obviously important news.
- The comedy lives in the gap between how seriously the character takes it and how ridiculous it is. Never wink, never explain the joke, never admit it is satire.
- Use one or two of the character's signature moves (catchphrases, obsessions, verbal tics) per paragraph, woven into the topic, never instead of it.
- Where the character description asks for tangents, drifts, pivots or memories, keep each to a single sentence that ties back to the topic.
- The voice changes how the story is told, never what the story is about.
`.trim();

// Every example line the model has been shown (samples + quoted examples inside the
// persona description). Models tend to paste these verbatim, so they are banned explicitly.
const exampleLines = (persona) => {
  const quoted = [...persona.prompt.matchAll(/["“]([^"”\n]{18,})["”]/g)].map((m) => m[1].trim());
  return [...new Set([...(persona.samples || []), ...quoted])];
};

const variety = `
Variety:
- Each catchphrase or signature line appears at most once in the whole piece.
- Vary how the paragraphs are built: do not repeat the same opening move, transition or closing pattern in every paragraph.
`.trim();

const tone = (persona) => {
  const samples = (persona.samples || []).map((s) => `- "${s}"`).join("\n");
  const banned = exampleLines(persona).map((s) => `- "${s}"`).join("\n");
  return [
    "# TONE: YOUR CHARACTER",
    persona.prompt.trim(),
    samples && `Sounds like (match this energy only):\n${samples}`,
    banned &&
      `Banned lines. These examples only show the style. Writing any of them, or the same sentence with a few words swapped, is a failure; invent new sayings, memories and comparisons every time:\n${banned}`,
    ironyRules,
    variety,
  ]
    .filter(Boolean)
    .join("\n\n");
};

// Compact roster for the weekly batch: brief + one sample per character.
const toneRoster = (personas) =>
  [
    "# TONE: THE CHARACTERS",
    ...personas.map((p) => `- ${p.name.split(" — ")[0]}: ${p.brief}. Sounds like: "${(p.samples || [])[0] || ""}"`),
    "Onion irony: each narrator believes every word and reports the absurd with total conviction. One or two signature moves per paragraph, woven into the slot's topic; tangents at most one sentence. The 'Sounds like' lines only show style: never reuse them or near-copies. Never wink, never explain the joke.",
  ].join("\n");

module.exports = { tone, toneRoster };
