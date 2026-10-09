// CO-STAR prompt assembly (Context, Objective, Style, Tone, Audience, Response)
// plus Boundaries. Section order: Context, Objective, Tone, Style, Audience,
// Boundaries, Response; the user's topic always comes last, in the user message.
const { systemPrompts } = require("./SystemPromptsManager");
const { context } = require("./sections/context");
const { objective } = require("./sections/objective");
const { tone, toneRoster } = require("./sections/tone");
const { style } = require("./sections/style");
const { audience } = require("./sections/audience");
const { boundaries } = require("./sections/boundaries");
const { response } = require("./sections/response");

const join = (...sections) => sections.filter(Boolean).join("\n\n");

const buildStoryMessages = ({ topic, persona, isCharacterMode, exclusions = [] }) => {
  const mode = isCharacterMode ? "character" : "news";
  const system = join(
    context,
    objective[mode](String(topic).trim()),
    tone(persona),
    style.full,
    audience,
    boundaries.full,
    response[mode]
  );
  const user = join(
    `Topic: ${String(topic).trim()}\nEvery paragraph must be about this topic. If the topic misspells a real person, party or place, use the correct spelling.`,
    exclusions.length ? `Avoid these topics or people: ${exclusions.join(", ")}.` : "",
    "Reply in exactly this shape, starting with the TITLE line:\nTITLE: <title>\n\n<paragraph 1>\n\n<paragraph 2>\n\n<paragraph 3>"
  );
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Assigns a narrator to every slot up front, so voices are spread evenly and no
// category repeats a narrator.
const assignNarrators = (categories, perCategory, personas) => {
  let pool = [];
  return categories.flatMap((c) =>
    Array.from({ length: perCategory }, () => {
      if (pool.length === 0) pool = shuffle(personas);
      return { category: c, narrator: pool.pop() };
    })
  );
};

const buildWeeklyMessages = ({ categories, perCategory, personas = Object.values(systemPrompts) }) => {
  const total = categories.length * perCategory;
  const slots = assignNarrators(categories, perCategory, personas);
  const system = join(
    context,
    objective.weekly(total),
    toneRoster(personas),
    style.compact,
    boundaries.compact,
    response.weekly(total)
  );
  const user = join(
    `Write these ${total} articles, in this order:`,
    slots
      .map((s, i) => `${i + 1}. ${s.category.category}, narrated by ${s.narrator.name.split(" — ")[0]}. Brief: ${s.category.prompt}`)
      .join("\n")
  );
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
};

module.exports = { buildStoryMessages, buildWeeklyMessages };
