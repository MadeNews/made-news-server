
const toxicity = require('@tensorflow-models/toxicity');
const tf = require('@tensorflow/tfjs');

let toxicityModel;

async function loadModel() {
  toxicityModel = await toxicity.load(0.85); // confidence threshold
}

async function checkWithNLP(prompt) {
  if (!toxicityModel) throw new Error("Toxicity model not loaded");

  const predictions = await toxicityModel.classify([prompt]);

  for (const pred of predictions) {
    if (pred.results[0].match) {
      throw new Error(`NO_GO_AREA_DETECTED: NLP flagged "${pred.label}"`);
    }
  }
}

const bannedKeywords = [
  // 🚫 Sexual & Abuse-related
  "rape", "sexual assault", "molestation", "child abuse", "child pornography", 
  "pedophile", "incest", "bestiality", "necrophilia", "sex trafficking",

  // 🚫 Hate Speech & Discrimination
  "nazi", "white supremacy", "kkk", "racism", "antisemitism", "islamophobia", 
  "homophobia", "transphobia", "ethnic cleansing", "slur", "bigot", "lynch",

  // 🚫 Violence, Gore, Terror
  "mass shooting", "school shooting", "terrorism", "bombing", "beheading",
  "execution", "mutilation", "torture", "genocide", "war crime",

  // 🚫 Suicide & Self-harm
  "suicide", "self-harm", "cutting", "kill myself", "end my life",

  // 🚫 Drugs & Illegal Activity
  "cocaine", "heroin", "meth", "lsd", "drug trafficking", 
  "overdose", "illegal weapons", "black market", "deep web",

  // 🚫 Cults / Rituals
  "satanic ritual", "human sacrifice", "blood cult", "occult murder"
];

const bannedPatterns = bannedKeywords.map(keyword => {
  const escaped = keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`\\b${escaped.replace(/\s+/g, '[\\s\\W_]*')}\\b`, 'i');
});

const obfuscatedPatterns = [
  /r[\W_]*a[\W_]*p[\W_]*e/i,
  /p[\W_]*e[\W_]*d[\W_]*o/i,
  /s[\W_]*u[\W_]*i[\W_]*c[\W_]*i[\W_]*d[\W_]*e/i,
  /k[\W_]*i[\W_]*l[\W_]*l[\W_]*\s*myself/i,
  /c[\W_]*u[\W_]*t[\W_]*t[\W_]*i[\W_]*n[\W_]*g/i,
  /n[\W_]*a[\W_]*z[\W_]*i/i,
  /l[\W_]*y[\W_]*n[\W_]*c[\W_]*h/i
];

async function validatePromptOrThrow(prompt) {
  const normalized = prompt.toLowerCase();

  for (const regex of bannedPatterns) {
    if (regex.test(normalized)) {
      const keywordMatch = regex.toString().match(/\b([a-z\s]+)\b/i);
      throw new Error(`NO_GO_AREA_DETECTED: User tried topic "${keywordMatch?.[1] || 'unknown'}"`);
    }
  }

  for (const obfuscatedRegex of obfuscatedPatterns) {
    if (obfuscatedRegex.test(normalized)) {
      throw new Error(`NO_GO_AREA_DETECTED: User tried obfuscated unsafe topic`);
    }
  }

  await loadModel();
  await checkWithNLP(prompt);

}

module.exports = {
    validatePromptOrThrow
}
