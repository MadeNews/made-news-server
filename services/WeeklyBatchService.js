// Generates the whole weekly feed in ONE Groq request so it fits the free tier
// (gpt-oss-120b: 8K tokens/min, 200K tokens/day). One run costs ~8K tokens
// instead of ~90K for 25 separate calls.
const { groqConfig, buildChatBody, postChatCompletion, estimateTokens } = require("../config/groq");
const { buildWeeklyMessages } = require("../prompts");
const { parseBatch } = require("./weeklyBatchParser");
const { getWeeklyArticles, saveWeeklyArticles } = require("./weeklyPostsStorageServices");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const callGroq = (messages, maxTokens) =>
  postChatCompletion(
    buildChatBody({
      model: groqConfig.weeklyModel,
      messages,
      temperature: groqConfig.weekly.temperature,
      maxTokens,
      reasoningEffort: groqConfig.weekly.reasoningEffort,
    })
  );

/**
 * Builds and saves the weekly feed. Categories that come back short keep
 * last week's articles, so the feed is never left empty.
 */
const generateWeeklyFeed = async (categories, perCategory = 2) => {
  const messages = buildWeeklyMessages({ categories, perCategory });
  const inputTokens = estimateTokens(messages.map((m) => m.content).join("\n"));
  const maxTokens = Math.min(
    groqConfig.weekly.maxTokens,
    groqConfig.tpmLimit - inputTokens - groqConfig.tokenSafetyMargin
  );
  if (maxTokens < 500) {
    throw new Error(`Token budget too small (${maxTokens}); check GROQ_TPM_LIMIT / WEEKLY_MAX_TOKENS.`);
  }
  console.log(`🧮 Weekly batch: ~${inputTokens} input tokens, max ${maxTokens} output tokens`);

  let response;
  try {
    response = await callGroq(messages, maxTokens);
  } catch (error) {
    if (error.response?.status !== 429) throw error;
    const wait = Math.min(Number(error.response.headers?.["retry-after"] || 60), groqConfig.retryMaxWaitSeconds);
    console.warn(`⚠️ Rate limited. Retrying once in ${wait}s...`);
    await delay(wait * 1000);
    response = await callGroq(messages, maxTokens);
  }

  const choice = response.data.choices[0];
  const raw = (choice.message.content || "").trim();
  console.log(`📦 finish_reason=${choice.finish_reason}, usage=${JSON.stringify(response.data.usage)}`);

  const fresh = parseBatch(raw, categories, perCategory);
  const previous = (await getWeeklyArticles())?.articles || {};

  const merged = {};
  const report = {};
  for (const { category } of categories) {
    const got = fresh[category];
    if (got.length >= perCategory) {
      merged[category] = got;
      report[category] = `new (${got.length})`;
    } else if (got.length > 0) {
      // top up with last week's articles so every category still has a full set
      const oldTitles = new Set(got.map((a) => a.title.toLowerCase()));
      const filler = (previous[category] || []).filter((a) => !oldTitles.has(a.title?.toLowerCase()));
      merged[category] = [...got, ...filler].slice(0, perCategory);
      report[category] = `partial (${got.length} new)`;
    } else {
      merged[category] = previous[category] || [];
      report[category] = "kept last week";
    }
  }

  const newCount = Object.values(fresh).reduce((n, a) => n + a.length, 0);
  if (newCount === 0) {
    console.error("❌ Weekly batch produced no articles. Raw output start:", raw.slice(0, 500));
    throw new Error("Weekly batch produced no usable articles; previous feed left untouched.");
  }

  await saveWeeklyArticles(merged);
  console.log("✅ Weekly articles saved to Firestore!", report);
  return { newCount, report, usage: response.data.usage };
};

module.exports = { generateWeeklyFeed, parseBatch };
