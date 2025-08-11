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
  const satireName = req.query.satireStyle || null;



  if (!title) {
    console.log("❌ Title missing");
    return res.status(400).json({ success: false, error: "Missing 'title'" });
  }

  let result;

  try {
    if (satireName != null) {
      result = await generateSatireStory(title, [], satireName);
    } else {
      result = await generateSatireStory(title, []);
    }

    if (result?.error) {
      console.log("❌ LLM returned error:", result.message);
      return res.status(500).json({ success: false, error: result.message });
    }

    console.log("✅ Success");
    res.json({ success: true, ...result });

  } catch (err) {
    console.log("❌ Internal error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});


router.get("/generate/random", async (_req, res) => {
  const result = await generateRandomStory();
  if (result.error)
    return res.status(500).json({ success: false, error: result.message });

  res.json({ success: true, ...result });
});

router.get("/weeklyArticles", async (_req, res) => {
  try {

    const data = await getWeeklyArticles();

    if (data) {
      return res.json({ success: true, articles: data.articles });
    } else {
      return res.status(404).json({ success: false, error: "No weekly articles found." });
    }

  } catch (err) {
    console.error("❌ Error accessing Firestore:", err.message);
    res.status(500).json({ success: false, error: "Unable to load articles." });
  }

});

module.exports = router;
