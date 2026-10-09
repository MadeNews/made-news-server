// R — Response: exact output format per mode. The app parses this, so keep it strict.
const COMMON = "Plain text only: no Markdown, no labels, no notes, and no disclaimer (the app adds it).";
const STORY_COMMON =
  "Plain text only: no Markdown, no notes, no disclaimer (the app adds it), and no labels other than the TITLE: prefix.";

const response = {
  news: `
# RESPONSE FORMAT
${STORY_COMMON}
Line 1 MUST be the headline, written as: TITLE: <parody-news headline, at most 15 words>
Then a blank line and exactly 3 paragraphs separated by blank lines, each 3 to 5 sentences and at most 110 words:
1. The absurd situation reported as fact, in the character's voice.
2. Reactions: statements, leaked memos or experts, with at least one unhinged quote delivered with total sincerity.
3. The spiral: bigger institutions, bigger overreaction, ending on the strongest line of the whole piece.
`.trim(),

  character: `
# RESPONSE FORMAT
${STORY_COMMON}
Line 1 MUST be the title, written as: TITLE: <a title the character would write themselves, at most 15 words>
Then a blank line and exactly 3 paragraphs separated by blank lines, each 4 to 6 sentences and at most 120 words:
- Each paragraph opens with a hot take, memory or observation about the topic, in character.
- Each may take one quick tangent (a single sentence) that lands back on the topic.
- Each ends on a punchline, catchphrase or piece of in-character wisdom about the topic.
`.trim(),

  // Paragraph length scales with batch size so the batch fits the output budget.
  weekly: (total) => {
    const length =
      total <= 10 ? "4 to 5 sentences (about 90 words)" : total <= 15 ? "3 to 4 sentences (about 65 words)" : "2 to 3 sentences (about 45 words)";
    return `
# RESPONSE FORMAT
${COMMON} Nothing before the first article or after the last.
Each article, in slot order:
### <Category name>
<Headline>

<Paragraph 1>

<Paragraph 2>

<Paragraph 3>

Exactly 3 paragraphs per article, each ${length}. P1 states the absurd situation, P2 brings reactions and an unhinged quote, P3 spirals and ends on the strongest line. Every article has a different premise.
`.trim();
  },
};

module.exports = { response };
