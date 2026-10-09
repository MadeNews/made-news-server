const { groqConfig, buildChatBody, postChatCompletion } = require("../config/groq");
const { promptManager } = require("../prompts/SystemPromptsManager");
const { validatePromptOrThrow } = require("../utils/promptValidation");
const { SATIRE_DISCLAIMER } = require("../prompts/disclaimer");

const { buildStoryMessages } = require("../prompts");

const TITLE_PREFIX = /^\s*[#*_\s]*(title|headline)\s*[:\-–]\s*/i;
const cleanTitle = (t) => t.replace(TITLE_PREFIX, "").replace(/^[#*_"“\s]+|[*_"”\s]+$/g, "").trim();

// Splits a model reply into title + paragraphs. Detects a missing title instead of
// mistaking the first paragraph for one. Any disclaimer the model wrote is dropped;
// the app adds the exact one.
const parseStory = (raw) => {
  let blocks = String(raw)
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/satire service like the onion/i.test(b));

  // Some replies separate paragraphs with single line breaks; split those too.
  if (blocks.length <= 2 && blocks.some((b) => b.includes("\n"))) {
    blocks = blocks.flatMap((b) => b.split(/\n+/)).map((b) => b.trim()).filter(Boolean);
  }

  let title = "";
  if (blocks.length) {
    const [firstLine, ...restOfBlock] = blocks[0].split("\n");
    const words = blocks[0].split(/\s+/).length;
    if (TITLE_PREFIX.test(firstLine)) {
      // "TITLE: ..." line; text directly under it (no blank line) is a paragraph
      title = cleanTitle(firstLine);
      blocks = restOfBlock.join("\n").trim() ? [restOfBlock.join("\n").trim(), ...blocks.slice(1)] : blocks.slice(1);
    } else if (words <= 25 && restOfBlock.length === 0) {
      title = cleanTitle(firstLine);
      blocks = blocks.slice(1);
    }
  }
  return { title, paragraphs: blocks };
};

// Fallback when the model skipped the title: one small call (~500 tokens) for a headline.
const generateTitle = async (paragraphs, persona, isCharacterMode) => {
  try {
    const result = await postChatCompletion(
      buildChatBody({
        model: groqConfig.model,
        messages: [
          {
            role: "system",
            content: `You write titles for MadeNews, a satire app like The Onion. Write one ${
              isCharacterMode ? "title the narrator would write themselves" : "parody-news headline"
            } for the article below, in the voice of ${persona.name}. At most 15 words. Output only the title.`,
          },
          { role: "user", content: paragraphs.slice(0, 2).join("\n\n") },
        ],
        temperature: 0.9,
        maxTokens: 400,
        // "low" for reasoning models; omitted when reasoning is off (e.g. Llama)
        reasoningEffort: (isCharacterMode ? groqConfig.character : groqConfig.story).reasoningEffort ? "low" : null,
      })
    );
    return cleanTitle((result.data.choices[0].message.content || "").split("\n")[0]);
  } catch (error) {
    console.warn("Title fallback failed:", error.message);
    return "";
  }
};

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

  const messages = buildStoryMessages({
    topic: prompt,
    persona: systemPrompt,
    isCharacterMode,
    exclusions: disallowedTitles,
  });

  try {
    await validatePromptOrThrow(prompt);

    const mode = isCharacterMode ? groqConfig.character : groqConfig.story;

    const result = await postChatCompletion(
      buildChatBody({
        model: groqConfig.model,
        messages,
        temperature: mode.temperature,
        maxTokens: mode.maxTokens,
        reasoningEffort: mode.reasoningEffort,
      })
    );

    const choice = result.data.choices[0];
    const raw = (choice.message.content || "").trim();
    console.log(
      `📦 story finish_reason=${choice.finish_reason} tokens=${JSON.stringify(result.data.usage?.completion_tokens_details || {})} completion=${result.data.usage?.completion_tokens}`
    );

    if (raw.startsWith("NO_GO_AREA_DETECTED")) {
      console.log("Flagged by model:", raw);
      throw new Error(raw);
    }

    const parsed = parseStory(raw);
    const storyParagraphs = parsed.paragraphs;
    let finalTitle = parsed.title;

    if (!finalTitle && storyParagraphs.length >= 2) {
      console.warn("Model skipped the title; generating one.");
      finalTitle = await generateTitle(storyParagraphs, systemPrompt, isCharacterMode);
    }

    if (!finalTitle || storyParagraphs.length < 2) {
      console.warn(
        `⚠️ Unusable reply: finish_reason=${choice.finish_reason}, title=${JSON.stringify(finalTitle)}, paragraphs=${storyParagraphs.length}, raw start: ${JSON.stringify(raw.slice(0, 300))}`
      );
      throw new Error(
        choice.finish_reason === "length"
          ? "Incomplete model response (hit the token cap; raise STORY_MAX_TOKENS/CHARACTER_MAX_TOKENS or lower reasoning effort)"
          : "Incomplete model response"
      );
    }

    const paragraphs = [...storyParagraphs, SATIRE_DISCLAIMER];

    return {
      title: finalTitle,
      paragraphs,
      appGenerated: false,
      createdAt: new Date().toISOString(),
      satireStyle: systemPrompt.id || null,
    };

  } catch (error) {
    const groqError = error.response?.data;
    console.error("Failed to generate satire:", error.message, groqError ?? "");

    if (error.message.startsWith("NO_GO_AREA_DETECTED")) {
      const flaggedTerm = error.message.split('"')[1] || "this topic";
      return {
        error: true,
        message: `🚫 The topic "${flaggedTerm}" isn't supported in this app. Please choose something more appropriate for satire.`,
      };
    }

    if (error.response?.status === 429) {
      return {
        error: true,
        rateLimited: true,
        message: "Rate limit reached.",
      };
    }

    return {
      error: true,
      message: "We're having technical difficulties generating this story. Please try again later.",
    };
  }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const generateRandomStory = async () => {
  const userPrompt = `Write a new MadeNews satire story. Generate a fresh satirical topic on your own.`;
  return await generateSatireStory(userPrompt);
};

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

module.exports = {
  parseStory,
  generateSatireStory,
  generateRandomStory,
};