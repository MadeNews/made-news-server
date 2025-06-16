const { generateSatireStory } = require("./llama");
const categories = require("./categories.json");
const { saveWeeklyArticles } = require("./services/weeklyPostsStorageServices");

const generateAll = async () => {
  const categorizedArticles = {};

  for (const categoryObject of categories) {
    const articles = [];

    for (let i = 0; i < 5; i++) {
      const result = await generateSatireStory(categoryObject.prompt);

      if (typeof result === "string") {
        const title = result.split("\n").find((line) => line.trim() !== "") || "Untitled";
        articles.push({
          title,
          content: result,
          createdAt: new Date().toISOString(),
          category: categoryObject.category,
        });
      } else if (result?.title && result?.paragraphs) {
        articles.push({
          title: result.title,
          content: result.paragraphs.join("\n\n"),
          createdAt: result.createdAt || new Date().toISOString(),
          category: categoryObject.category,
        });
      } else {
        console.warn(`⚠️ Skipped a failed story in ${categoryObject.category}`);
      }
    }

    categorizedArticles[categoryObject.category] = articles;
  }

  await saveWeeklyArticles(categorizedArticles);

  console.log("✅ Weekly articles saved to Firestore!");
};

module.exports = generateAll;
