const axios = require("axios");
const dotenv = require("dotenv");
const { promptManager } = require("./utils/SystemPromptsManager");
dotenv.config();

const formatPrompt = `
Tone: Sarcastic, rant-driven, and sharply satirical.
Style: Aggressive yet humorous, mimicking the passionate rants of internet meme culture in a news format.

Rules:
- Do NOT use Markdown, HTML, JSON, or any other formatting.
- Output exactly one title (the user's provided title) followed by exactly 3 paragraphs.
- Paragraphs must be separated by a blank line.
- Stay precisely on topic as given by the user, incorporating a rant-like critique within a structured news narrative.
- Articles must feel like humorous rants addressing the absurdity or frustration surrounding the user's prompt.

Topics You Might Include (only if the user's input explicitly suggests):
- Politicians
- Businesspeople
- Actors
- Artists
- Celebrities
- Pop culture trends
- Tech trends

Ensure your response engages meme lovers through passionate yet humorous rants clearly derived from and centered around the user's specific scenario or title.`;

// === TRACK USED TITLES IN-MEMORY ===
// Replace with Firestore or Redis for persistence across sessions
const usedTitles = new Set();

const generateSatireStory = async (
  prompt,
  disallowedTitles = [],
  satireType = null
) => {
  // Ensure disallowedTitles is always an array
  disallowedTitles = Array.isArray(disallowedTitles) ? disallowedTitles : [];

  // Choose the appropriate system prompt
  const systemPrompt = satireType
    ? promptManager.getPromptById(satireType)
    : promptManager.getRandomPrompt();

    console.log(systemPrompt)


  const exclusionText =
    disallowedTitles.length > 0
      ? `Avoid using any of these topics or people: ${disallowedTitles.join(", ")}.`
      : "";

  const userPrompt = `
${prompt}

${exclusionText}

Format strictly:
<One-line title>

<Three standalone absurdist paragraphs separated by a blank line>
`;

  try {
    const result = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: formatPrompt },
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = result.data.choices[0].message.content.trim();
    const [titleLine, ...rest] = raw.split(/\n\s*\n/);
    const finalTitle = titleLine.trim();
    const content = rest.join("\n\n").trim();
    const paragraphs = content.split(/\n\s*\n/);

    if (!finalTitle || paragraphs.length < 2) {
      throw new Error("Incomplete model response");
    }

    const response = {
      title: finalTitle,
      paragraphs,
      appGenerated: false,
      createdAt: new Date().toISOString(),
    };

    // Only include satireType if provided
    if (satireType) response.satireType = satireType;

    return response;
  } catch (error) {
    console.error("Failed to generate satire:", error.message);
    return {
      error: true,
      message: "We're having technical difficulties generating this story.",
    };
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateRandomStory = async () => {
  const userPrompt = `
  Write a new MadeNews story as described. It should:
  - Have a sensational one-liner headline.
  - Use 2–3 real public figures in absurd situations.
  - Include at least one fake quote.
  - Be completely fictional and highly exaggerated.
  `;

  return await generateSatireStory(userPrompt);
};

// === 🗓️ WEEKLY GENERATOR ===
const generateWeeklyCategoryStories = async (prompt, category, count = 5) => {
  const articles = [];

  for (let i = 0; i < count; i++) {
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

    // 💤 Wait 25 seconds before next request
    if (i < count - 1) {
      console.log("⏳ Waiting 5 seconds before next story...");
      await delay(5000);
    }
  }

  return articles;
};

module.exports = {
  generateSatireStory,
  generateRandomStory,
  generateWeeklyCategoryStories,
};
