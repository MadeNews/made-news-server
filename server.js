const generateSatireStory = require('./llama')
const express = require('express')
const cors = require('cors')
const cron = require('node-cron');
const app = express()
const refreshWeeklyArticles = require("./refreshWeekly")
const fs = require('fs')
app.use(express.json())

app.use(cors({
  origin: '*', // For mobile apps, allow all (or use stricter IP validation via middleware if needed)
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.APP_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized access' });
  }
  next();
});

cron.schedule('1 0 * * 1', async () => {
  console.log('⏳ Running weekly article generation...');
  await refreshWeeklyArticles();
  console.log('✅ Weekly articles refreshed.');
});

app.get("/api/generate", async (req, res) => {
  try {
    const title = req.query.title; // ✅ fix here

    if (!title) {
      return res.status(400).json({ success: false, error: "Missing 'title' query parameter" });
    }

    const result = await generateSatireStory(title);
    res.json({ success: true, content: {
      "title": title,
      "content": result,
      "createdAt": new Date().toISOString() 
    } });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/weeklyArticles", async (req, res) => {
  
  try {
    // Check if the file exists
    if (!fs.existsSync('./articles.json')) {
      console.warn("⚠️ articles.json not found. Regenerating...");
      await refreshWeeklyArticles(); // call your article generation function
    }

    // Read and parse the file
    const data = fs.readFileSync('./articles.json', 'utf-8');
    const parsed = JSON.parse(data);

    // Validate structure
    if (
      !parsed ||
      !parsed.articles ||
      typeof parsed.articles !== 'object' ||
      Object.keys(parsed.articles).length === 0
    ) {
      console.warn("⚠️ Invalid or empty articles.json. Regenerating...");
      await refreshWeeklyArticles();
      const refreshed = JSON.parse(fs.readFileSync('./articles.json', 'utf-8'));
      return res.json({ success: true, ...refreshed });
    }

    // Return valid content
    return res.json({ success: true, ...parsed });

  } catch (err) {
    console.error("❌ Failed to load weekly articles:", err.message);
    res.status(500).json({ success: false, error: "Unable to load weekly articles." });
  }
});


  
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
