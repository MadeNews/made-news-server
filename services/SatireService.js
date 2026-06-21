const axios = require("axios");
const dotenv = require("dotenv");
const { promptManager } = require("../prompts/SystemPromptsManager");
const { validatePromptOrThrow } = require("../utils/promptValidation");

dotenv.config();

const situationalPrompt = require("../prompts/situationalPrompt");
const restrictionsPrompt = require("../prompts/restrictionsPrompt");
const formatPrompt = require("../prompts/formatPrompt");
const characterFormatPrompt = require("../prompts/characterFormatPrompt")

const usedTitles = new Set();

const generateSatireStory = async (
  prompt,
  disallowedTitles = [],
  satireType = null
) => {
  disallowedTitles = Array.isArray(disallowedTitles) ? disallowedTitles : [];

  const isCharacterMode = !!satireType;

  const systemPrompt = satireType
    ? promptManager.getPromptById(satireType)
    : promptManager.getRandomPrompt();

  // Build message stack based on mode
  const messages = [
    { role: "system", content: restrictionsPrompt },
    ...(!isCharacterMode
      ? [
          { role: "system", content: situationalPrompt },
          { role: "system", content: formatPrompt },
        ]
      : [
          { role: "system", content: characterFormatPrompt },
        ]),
    { role: "system", content: systemPrompt.prompt },
  ];

  const exclusionText =
    disallowedTitles.length > 0
      ? `Avoid using any of these topics or people: ${disallowedTitles.join(", ")}.`
      : "";

  const userPrompt = `
${prompt}

${exclusionText}

Format strictly:
<One-line title>

<Three standalone paragraphs separated by a blank line>
`;

  try {
    validatePromptOrThrow(prompt);

    const temperature = isCharacterMode ? 0.88 : 0.70;
    const max_tokens = isCharacterMode ? 1000 : 1100;

    const result = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "groq/compound",
        messages: [...messages, { role: "user", content: userPrompt }],
        temperature,
        top_p: 0.9,
        max_tokens,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = result.data.choices[0].message.content.trim();

    if (raw.startsWith("NO_GO_AREA_DETECTED")) {
      console.log("Flagged by model:", raw);
      throw new Error(raw);
    }

    const [titleLine, ...rest] = raw.split(/\n\s*\n/);
    const finalTitle = titleLine.trim();
    const content = rest.join("\n\n").trim();
    const paragraphs = content.split(/\n\s*\n/);

    if (!finalTitle || paragraphs.length < 2) {
      throw new Error("Incomplete model response");
    }

    return {
      title: finalTitle,
      paragraphs,
      appGenerated: false,
      createdAt: new Date().toISOString(),
      satireStyle: systemPrompt.id || null,
    };

  } catch (error) {
    console.error("Failed to generate satire:", error.message);

    if (error.message.startsWith("NO_GO_AREA_DETECTED")) {
      const flaggedTerm = error.message.split('"')[1] || "this topic";
      return {
        error: true,
        message: `🚫 The topic "${flaggedTerm}" isn't supported in this app. Please choose something more appropriate for satire.`,
      };
    }

    return {
      error: true,
      message: "We're having technical difficulties generating this story. Please try again later.",
    };
  }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateRandomStory = async () => {
  const userPrompt = `Write a new MadeNews satire story. Generate a fresh satirical topic on your own.`;
  return await generateSatireStory(userPrompt);
};

const generateWeeklyCategoryStories = async (category, count = 5) => {
  const articles = [];

  for (let i = 0; i < count; i++) {
    const prompt = `Write a MadeNews satire story in the category: ${category}.`;
    const result = await generateSatireStory(prompt, Array.from(usedTitles));

    if (result?.title && result?.paragraphs) {
      usedTitles.add(result.title.toLowerCase());
      articles.push({
        title: result.title,
        content: result.paragraphs.join("\n\n"),
        createdAt: result.createdAt,
        appGenerated: true,
        category,
      });
      console.log(`✅ Story ${i + 1}/${count} for [${category}] generated.`);
    } else {
      console.warn(`⚠️ Skipped a failed story for category: ${category}`);
    }

    if (i < count - 1) {
      console.log("⏳ Waiting 5 seconds before next story...");
      await delay(5000);
    }
  }

  return articles;
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  generateSatireStory,
  generateRandomStory,
  generateWeeklyCategoryStories,
};