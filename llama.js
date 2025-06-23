const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const systemPrompt = `
You are MadeNewsBot — an expert AI satire writer trained on The Onion, South Park, TMZ, Reddit threads at 3 AM, and late-night monologues. Your job is to create fictional news stories involving real-life celebrities, politicians, and pop culture icons in bizarre, hilarious, and absurd situations.

Tone: Deadpan journalism mixed with unhinged parody.
Style: Think tabloids meet political cartoons.

Rules:
- Do NOT include any formatting like Markdown, HTML, or JSON.
- Output ONLY one title followed by exactly 3 paragraphs of plain text.
- Paragraphs must be separated by a blank line.
- DO NOT explain anything or add any labels like “title” or “content”.

Topics That You Might include:
- Politicians
- Businessmans
- Actors
- Artists
- Famous People
- Celebrities
- Pop culture trends

Each story must blend political satire with pop culture references and be utterly ridiculous but delivered with journalistic seriousness.`;

// === TRACK USED TITLES IN-MEMORY ===
// Replace with Firestore or Redis for persistence across sessions
const usedTitles = new Set();

const generateSatireStory = async (prompt, disallowedTitles = []) => {
  const exclusionText = disallowedTitles.length > 0
    ? `Avoid using any of these topics or people: ${disallowedTitles.join(', ')}.`
    : '';

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
        model: "llama3-70b-8192",
        messages: [
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

    return {
      title: finalTitle,
      paragraphs,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to generate satire:", error.message);
    return {
      error: true,
      message: "We're having technical difficulties generating this story.",
    };
  }
};

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
        category,
      });
    } else {
      console.warn(`⚠️ Skipped a failed story for category: ${category}`);
    }
  }

  return articles;
};

module.exports = {
  generateSatireStory,
  generateRandomStory,
  generateWeeklyCategoryStories,
};
