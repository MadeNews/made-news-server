// Central Groq configuration. Everything that depends on what Groq currently
// offers (models, endpoint, rate limits, reasoning params) is read from env
// vars here, so a change on Groq's side is a config change, not a code change.
// See .env.example for every variable and its default.
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const num = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (Number.isFinite(value)) return value;
  console.warn(`⚠️ ${name}="${raw}" is not a number; using default ${fallback}`);
  return fallback;
};
const str = (name, fallback) => (process.env[name] ?? "").trim() || fallback;
const bool = (name, fallback) => {
  const raw = (process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
};

// "off" / "none" disables reasoning params entirely (for non-reasoning models,
// which reject them).
const parseEffort = (raw) =>
  ["off", "none", "false", "0"].includes(String(raw).toLowerCase()) ? null : String(raw).toLowerCase();
const reasoningEffort = parseEffort(str("GROQ_REASONING_EFFORT", "low"));
// Per-mode overrides; fall back to GROQ_REASONING_EFFORT.
const effortFor = (name) => (process.env[name] ?? "").trim() ? parseEffort(process.env[name].trim()) : reasoningEffort;

const groqConfig = {
  apiUrl: str("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"),
  apiKey: process.env.GROQ_API_KEY,
  model: str("GROQ_MODEL", "openai/gpt-oss-120b"),
  weeklyModel: str("WEEKLY_GROQ_MODEL", str("GROQ_MODEL", "openai/gpt-oss-120b")),

  reasoningEffort,
  hideReasoning: bool("GROQ_HIDE_REASONING", true),

  // Rate limits of your Groq plan (console.groq.com/settings/limits)
  tpmLimit: num("GROQ_TPM_LIMIT", 8000),
  tokenSafetyMargin: num("GROQ_TOKEN_SAFETY_MARGIN", 350),
  charsPerToken: num("GROQ_CHARS_PER_TOKEN", 3.5),

  requestTimeoutMs: num("GROQ_REQUEST_TIMEOUT_MS", 120000),
  retryMaxWaitSeconds: num("GROQ_RETRY_MAX_WAIT_SECONDS", 65),

  // Sampling / length per generation mode
  topP: num("GROQ_TOP_P", 0.9),
  // Reasoning tokens count toward maxTokens, so medium effort needs headroom.
  story: {
    temperature: num("STORY_TEMPERATURE", 0.85),
    maxTokens: num("STORY_MAX_TOKENS", 3000),
    reasoningEffort: effortFor("STORY_REASONING_EFFORT"),
  },
  character: {
    temperature: num("CHARACTER_TEMPERATURE", 0.95),
    maxTokens: num("CHARACTER_MAX_TOKENS", 3000),
    reasoningEffort: effortFor("CHARACTER_REASONING_EFFORT"),
  },
  weekly: {
    temperature: num("WEEKLY_TEMPERATURE", 0.85),
    reasoningEffort: effortFor("WEEKLY_REASONING_EFFORT"),
    maxTokens: num("WEEKLY_MAX_TOKENS", Infinity), // extra cap; budget is derived from the TPM limit
  },
};

if (!groqConfig.apiKey) console.warn("⚠️ GROQ_API_KEY is not set; Groq requests will fail.");

const estimateTokens = (text) => Math.ceil(text.length / groqConfig.charsPerToken);

// Builds the request body, adding reasoning params only when enabled.
const buildChatBody = ({ model, messages, temperature, maxTokens, reasoningEffort: effort }) => {
  const reasoning = effort === undefined ? groqConfig.reasoningEffort : effort;
  return {
    model,
    messages,
    temperature,
    top_p: groqConfig.topP,
    max_completion_tokens: maxTokens,
    ...(reasoning
      ? {
          reasoning_effort: reasoning,
          ...(groqConfig.hideReasoning ? { include_reasoning: false } : {}),
        }
      : {}),
  };
};

const postChatCompletion = (body) =>
  axios.post(groqConfig.apiUrl, body, {
    headers: {
      Authorization: `Bearer ${groqConfig.apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: groqConfig.requestTimeoutMs,
  });

module.exports = { groqConfig, buildChatBody, postChatCompletion, estimateTokens };
