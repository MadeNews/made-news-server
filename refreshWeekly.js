const categories = require("./categories.json");
const { saveWeeklyArticles } = require("./services/weeklyPostsStorageServices");
const { generateWeeklyCategoryStories } = require("./services/SatireService");

const generateAll = async () => {

  const categorizedArticles = {};

  for (const categoryObject of categories) {
    const stories = await generateWeeklyCategoryStories(
      categoryObject.prompt,
      categoryObject.category
    );
    categorizedArticles[categoryObject.category] = stories;
  }

  await saveWeeklyArticles(categorizedArticles);

  console.log("✅ Weekly articles saved to Firestore!");
};

module.exports = generateAll;
