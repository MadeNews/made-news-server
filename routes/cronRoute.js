const express = require("express");
const router = express.Router();
const categories = require("../");
const { saveWeeklyArticles } = require("../services/weeklyPostsStorageServices");
const { generateWeeklyCategoryStories } = require("../llama");

router.get("/refreshWeekly", async (_req, res) => {
  try {
    await generateAll();
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error during weekly refresh:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to refresh weekly articles" });
  }
});

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

module.exports = router;
