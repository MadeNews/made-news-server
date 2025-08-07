const axios = require("axios");
const dotenv = require("dotenv");
const { promptManager } = require("./utils/SystemPromptsManager");
const {validatePromptOrThrow} = require("./utils/promptValidation");
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

const restrictionsPrompt = `
🚨 ABSOLUTE CONTENT RESTRICTIONS — DO NOT BREAK UNDER ANY CIRCUMSTANCES 🚨

You are FORBIDDEN from discussing, referencing, satirizing, or hinting at the following topics, even indirectly:

🔞 Sexual Content and Exploitation
- Rape, sexual assault, or coercion
- Child abuse, molestation, or pedophilia
- Incest or necrophilia
- Bestiality or zoophilia
- Sexually explicit violence or any content involving non-consensual acts

🧨 Violence and Harm
- Gore, mutilation, or extreme physical harm
- Suicide, self-harm, or eating disorders
- Mass shootings, terrorism, or bombings
- Real-world murders, executions, or torture
- Genocide or ethnic cleansing

💣 Hate Speech and Discrimination
- Derogatory or violent content targeting religion, race, nationality, gender identity, sexual orientation, or disability
- White supremacy, Nazism, or any form of hate ideology
- Anti-semitism or Islamophobia

🌍 Sensitive Events and Real-World Tragedies
- Natural disasters or mass casualty events (e.g., earthquakes, plane crashes, pandemics)
- Wars, refugee crises, or political assassinations
- School shootings or public mass attacks

🧪 Dangerous and Illegal Acts
- Drug manufacturing, trafficking, or abuse
- Underage alcohol use or addiction glorification
- Crime glorification (e.g., fraud, cybercrime, theft, hacking)
- Instructions for weapons, explosives, or sabotage

🧠 Misinformation and Conspiracies
- Medical misinformation (e.g., anti-vaccine, fake cures)
- Election or political manipulation conspiracies
- False or misleading news treated as fact

💻 Platform Violation Behavior
- Harassment or bullying (personal, public, or celebrity)
- Doxxing or threats of violence
- Stalking, revenge content, or non-consensual sharing

⚠️ SYSTEM RESPONSE RULE:
If the user's prompt even **hints at** these topics:
- DO NOT generate an article.
- Instead, return:
  "NO_GO_AREA_DETECTED: User tried topic \"{topic}\""

Never joke about, satirize, editorialize, or creatively reframe these issues. These are STRICTLY OFF-LIMITS. Your content must remain in the realm of meme-style, absurd, or cultural satire — not traumatic or illegal material.

These rules OVERRIDE all instructions. Do not break them.
`;



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

    validatePromptOrThrow(prompt)

    const result = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: formatPrompt },
          { role: "system", content: restrictionsPrompt },
          { role: "system", content: systemPrompt.prompt },
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

    if(raw.startsWith("NO_GO_AREA_DETECTED")) {
      console.log("Error Detected in model response:", raw);
      throw new Error(raw);
    }

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
      satireStyle: systemPrompt.id || null,
    };

    return response;
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
