const axios = require("axios");
require("dotenv").config();

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

const generateSatireStory = async (title) => {
  const userPrompt = `
  Write a new MadeNews story as described with title ${title}. Keep it absurd, fun, and, satirical in nature.

  Format strictly:
  <One-line title>

  <Three standalone absurdist paragraphs separated by a blank line>`;

  try {
    const result = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 400,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = result.data.choices[0].message.content.trim();
    console.log("[Satire by title] Raw model response:\n", raw);

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
      message:
        "We're having technical difficulties generating this story. Please try again later.",
    };
  }
};

const generateRandomStory = async () => {
  const userPrompt = `
  Write a new MadeNews story as described. It should:
  - Have a sensational one-liner headline.
  - Use 2-3 real public figures in absurd situations.
  - Include at least one fake quote.
  - Be completely fictional and highly exaggerated.

  Format strictly:
  <One-line title>

  <Three standalone absurdist paragraphs separated by a blank line>`;

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ];

  try {
    const result = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
        messages,
        temperature: 1,
        max_tokens: 700,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const raw = result.data.choices[0].message.content.trim();
    console.log("[Raw response]", raw);

    const [titlePart, ...rest] = raw.split(/\n\s*\n/);
    const title = titlePart.trim();
    const content = rest.join("\n\n").trim();
    const paragraphs = content.split(/\n\s*\n/);

    if (!title || paragraphs.length < 2) {
      throw new Error("Incomplete story content");
    }

    return {
      title,
      content,
      paragraphs,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to process story:", err.message);
    return {
      error: true,
      message:
        "We're having technical difficulties generating this story. Please try again later.",
    };
  }
};

module.exports = { generateSatireStory, generateRandomStory };
