const categories = require("./categories.json");
const { generateWeeklyFeed } = require("./services/WeeklyBatchService");

// One Groq request for the whole feed (see services/WeeklyBatchService.js).
const ARTICLES_PER_CATEGORY = Number(
  process.env.ARTICLES_PER_CATEGORY || process.env.WEEKLY_ARTICLES_PER_CATEGORY || 2
);

const generateAll = async () => generateWeeklyFeed(categories, ARTICLES_PER_CATEGORY);

module.exports = generateAll;
