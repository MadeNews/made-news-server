const express = require("express");
const router = express.Router();
const { generateSatireStory, generateRandomStory } = require("../llama"); // Adjust path if needed
const refreshWeeklyArticles = require("../refreshWeekly");
const {
  getWeeklyArticles,
  saveWeeklyArticles,
} = require("../services/weeklyPostsStorageServices");

const { isNewWeek, getLastWeekId,getCurrentWeekId } = require("../utils/dateHelpers");

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


const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

router.get("/weeklyArticles", async (_req, res) => {
  try {
    console.log("Trying to access firebase for week: " + getCurrentWeekId());

    const data = await getWeeklyArticles(getCurrentWeekId());

    // If data is fresh, return immediately
    if (data && data.updatedAt && !isNewWeek(data.updatedAt)) {
      return res.json({ success: true, articles: data.articles });
    }

    console.log("Data was not found or is outdated. Regenerating and providing fallback...");

    // Serve fallback data (last week's)
    const fallbackData = await getWeeklyArticles(getLastWeekId());
    res.json({
      success: true,
      articles: fallbackData?.articles || {},
      info: "⚠️ New stories are cooking. Showing last week’s content for now.",
    });

    // Run background task after response is sent
    setImmediate(async () => {
      try {
        const lockRef = db.collection("locks").doc("weeklyRefresh");
        const lockDoc = await lockRef.get();
        const now = Date.now();

        if (
          lockDoc.exists &&
          lockDoc.data().isRefreshing &&
          now - lockDoc.data().timestamp < 10 * 60 * 1000
        ) {
          console.log("⏳ Regeneration already in progress. Skipping.");
          return;
        }

        // Acquire lock
        await lockRef.set({
          isRefreshing: true,
          timestamp: now,
        });

        // Refresh data
        await refreshWeeklyArticles();
        console.log("✅ New weekly articles updated in background.");
      } catch (err) {
        console.error("❌ Background generation failed:", err.message);
      } finally {
        // Release lock
        await db.collection("locks").doc("weeklyRefresh").set({
          isRefreshing: false,
          timestamp: Date.now(),
        });
      }
    });
  } catch (err) {
    console.error("❌ Error accessing Firestore:", err.message);
    res.status(500).json({ success: false, error: "Unable to load articles." });
  }
});




module.exports = router;
