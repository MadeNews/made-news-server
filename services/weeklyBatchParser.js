// Pure parser for the weekly batch output (no Firebase, so the eval can use it).
const { SATIRE_DISCLAIMER } = require("../prompts/disclaimer");

// Parses "### Category\nHeadline\n\nP1\n\nP2\n\nP3" blocks. Tolerates partial/truncated output.
const parseBatch = (raw, categories, perCategory) => {
  const valid = new Map(categories.map((c) => [c.category.toLowerCase(), c.category]));
  const result = Object.fromEntries(categories.map((c) => [c.category, []]));
  const seenTitles = new Set();

  const blocks = raw.split(/^\s*#{2,4}\s*/m).slice(1);
  for (const block of blocks) {
    const lines = block.split("\n");
    const catName = valid.get(lines[0].replace(/[*:]/g, "").trim().toLowerCase());
    if (!catName) continue;

    const parts = lines.slice(1).join("\n").trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (parts.length < 4) continue; // headline + 3 paragraphs; drops a truncated last article

    const title = parts[0].replace(/^(headline|title)\s*:\s*/i, "").replace(/^["*]+|["*]+$/g, "").trim();
    const paragraphs = parts.slice(1, 4);
    if (!title || seenTitles.has(title.toLowerCase())) continue;
    if (result[catName].length >= perCategory) continue;

    seenTitles.add(title.toLowerCase());
    result[catName].push({
      title,
      content: [...paragraphs, SATIRE_DISCLAIMER].join("\n\n"),
      createdAt: new Date().toISOString(),
      appGenerated: true,
      category: catName,
    });
  }
  return result;
};

module.exports = { parseBatch };
