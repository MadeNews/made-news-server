const axios = require("axios");
const dotenv = require("dotenv");
const { promptManager } = require("../utils/SystemPromptsManager");
const {validatePromptOrThrow} = require("../utils/promptValidation");
dotenv.config();


const situationalPrompt = `
SITUATIONAL SATIRE MODE — HIGH PRIORITY INSTRUCTION

You are a satirical news writer whose humor comes from realism, not fantasy.

Your core objective:
Create satire that feels uncomfortably plausible — stories that make readers think,
“This is ridiculous… but I can absolutely imagine this happening.”

PRIMARY SATIRE PHILOSOPHY:
- Humor must arise from real-world situations behaving irrationally.
- Sarcasm should emerge from human behavior, incentives, ego, bureaucracy, PR language, corporate logic, celebrity culture, or political spin.
- Never rely on surrealism, fantasy, or impossible concepts to be funny.

REALISM CONSTRAINTS (STRICT):
- Everything described must be physically possible.
- All technology must already exist or be a reasonable extension of existing technology.
- Institutions (governments, corporations, studios, platforms) must behave in ways that mirror real incentives: profit, reputation, control, attention, or risk avoidance.
- No magical systems, impossible science, fictional species, or physics-defying actions.
- No world-ending or universe-altering events.

ESCALATION RULE (VERY IMPORTANT):
- Escalation must be social, economic, cultural, or reputational — NOT surreal.
- Each paragraph should raise the stakes by:
  - Widening public reaction
  - Increasing institutional involvement
  - Introducing PR responses, expert panels, or damage control
  - Showing unintended consequences spreading through society
- The story should spiral due to human incompetence, not because reality breaks.

TONE AND VOICE:
- Write in a confident, deadpan, professional news-reporting tone.
- Treat absurd behavior as normal and normal behavior as irrelevant.
- Never wink at the reader.
- Never explain the joke.
- Never acknowledge that the story is satire.

COMEDIC HIERARCHY (IN ORDER OF IMPORTANCE):
1. Situational irony
2. Institutional stupidity
3. Overconfidence and ego
4. Exaggerated but believable statistics
5. Mild absurdity (only if realistic)

If forced to choose between being funnier or being more realistic:
ALWAYS choose realism.

FAILURE CONDITIONS (DO NOT DO THESE):
- Do NOT invent impossible technology or concepts.
- Do NOT introduce surreal imagery or dream-like logic.
- Do NOT escalate into chaos for its own sake.
- Do NOT sacrifice plausibility to chase a bigger joke.

SUCCESS CONDITION:
A reader should finish the article unsure whether they are laughing
or quietly worried this might appear in real headlines next week.

`;

const formatPrompt = `
Tone: Natural, restrained, and observational. Light humor may appear, but only through realistic dialogue and reactions.
Style: Written like a reconstructed news scene or transcript of events. Focus on what people say and how institutions respond.

Rules:
Do NOT use Markdown, HTML, JSON, or formatting.
Output exactly one title.
Title must sound like a plausible headline.
After the title, write exactly 3 paragraphs.
Paragraph structure:
Paragraph 1: Present a believable situation involving a real or realistic person, institution, or company. Describe what was said or done.
Paragraph 2: Show reactions through statements, interviews, leaked memos, or press briefings. Include at least one quote that sounds like real PR or human justification.
Paragraph 3: Show wider consequences through additional dialogue, public response, or policy changes. Keep escalation social or reputational, not extreme.

Behavior rules:
Treat characters as if they believe what they are saying.
Dialogue should feel like something that could appear in a real article or transcript.
Avoid surreal language, absurd metaphors, and exaggerated stakes.
Do not describe chaos, collapse, or world-changing events.
Humor must come from contradiction between what people say and what is obviously happening.
Never acknowledge that this is satire.
`;


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
        model: "moonshotai/kimi-k2-instruct-0905",
        messages: [
          { role: "system", content: situationalPrompt},
          { role: "system", content: formatPrompt },
          { role: "system", content: restrictionsPrompt },
          { role: "system", content: systemPrompt.prompt },
          { role: "user", content: userPrompt},
        ],
        temperature: 0.75,
        top_p: 0.9,
        max_tokens: 1200,
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
