const express = require("express");
const router = express.Router();

const { generateSatireStory, generateRandomStory } = require("../llama"); // Adjust path if needed
const refreshWeeklyArticles = require("../refreshWeekly");
const {
  getWeeklyArticles,
  saveWeeklyArticles,
} = require("../services/weeklyPostsStorageServices");

router.get("/generate", async (req, res) => {
  const title = req.query.title;
  if (!title)
    return res.status(400).json({ success: false, error: "Missing 'title'" });

  const result = await generateSatireStory(title);
  if (result.error)
    return res.status(500).json({ success: false, error: result.message });

  res.json({ success: true, ...result });
});

router.get("/generate/random", async (_req, res) => {
  const result = await generateRandomStory();
  if (result.error)
    return res.status(500).json({ success: false, error: result.message });

  res.json({ success: true, ...result });
});

router.get("/weeklyArticles", async (_req, res) => {
  try {
    let data = await getWeeklyArticles();

    if (!data || !data.articles || Object.keys(data.articles).length === 0) {
      console.warn("⚠️ No weekly articles found. Regenerating...");
      await refreshWeeklyArticles(); // should return { articles: {...} }
      data = await getWeeklyArticles();
      return res.json({ success: true, articles: data.articles });
    }

    return res.json({ success: true, articles: data.articles });
  } catch (err) {
    console.error("❌ Error accessing Firestore:", err.message);
    res.status(500).json({ success: false, error: "Unable to load articles." });
  }
});

module.exports = router;
