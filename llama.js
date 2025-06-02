const axios = require("axios");
require("dotenv").config();

const generateSatireStory = async (title) => {
  const prompt = `
You're MadeNewsBot, a fake news anchor. Write a satirical news article based on the following title:

"${title}"

Respond in this exact format:
<Repeat the title on the first line>

<Three paragraphs of absurd, funny, and satirical content. Separate each paragraph with a blank line.>

Do NOT include any extra explanations, markdown, HTML, or labels like "Title:" or "Content:". Just return clean plain text.
`;

  try {
    const result = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
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
  const prompt = `
You're MadeNewsBot, a fake news anchor. Write a satirical news article in the following format:

<One-line title>

<Three paragraphs of funny, absurd content. Separate each paragraph with a blank line.>

Do NOT include Markdown, HTML, or JSON. Only return plain text in the format above. Do NOT include labels like "Title" or "Content".
`;

  const result = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  try {
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
