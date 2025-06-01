const { generateSatireStory, generateRandomStory } = require('./llama');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const refreshWeeklyArticles = require('./refreshWeekly');
app.use('/assets', express.static('public'));

require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
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

// Cron job for refreshing weekly articles
cron.schedule('1 0 * * 1', async () => {
  console.log('⏳ Running weekly article generation...');
  await refreshWeeklyArticles();
  console.log('✅ Weekly articles refreshed.');
});

// API: Generate satire from a provided title
app.get("/api/generate", async (req, res) => {
  try {
    const title = req.query.title;
    if (!title) {
      return res.status(400).json({ success: false, error: "Missing 'title' query parameter" });
    }

    const result = await generateSatireStory(title);
    if (result.error) {
      return res.status(500).json({ success: false, error: result.message });
    }

    res.json({ success: true, ...result });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// HTML Page: Display random story (with OG tags)
app.get("/story/random", async (req, res) => {
  try {
    const result = await generateRandomStory();

    if (result.error) {
      return res.status(500).send("Failed to generate story.");
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${result.title} | MadeNews</title>

        <!-- OG Meta -->
        <meta property="og:title" content="${result.title}" />
        <meta property="og:description" content="${result.paragraphs?.[0] || 'Generated satire'}" />
        <meta property="og:image" content="https://made-news-server.onrender.com/assets/app-logo.png" />
        <meta property="og:type" content="article" />

        <style>
          body {
            font-family: sans-serif;
            padding: 2rem;
            max-width: 720px;
            margin: auto;
            background-color: #fffef5;
          }
          h1 {
            color: #d24c3a;
          }
          p {
            line-height: 1.6;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <h1>${result.title}</h1>
        ${result.paragraphs.map(p => `<p>${p}</p>`).join('\n')}
      </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error("❌ Error generating random story:", err.message);
    res.status(500).send("Failed to generate story.");
  }
});

// API: Random satire story as JSON
app.get("/api/story/random", async (req, res) => {
  try {
    const result = await generateRandomStory();
    if (result.error) {
      return res.status(500).json({ success: false, error: result.message });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Return weekly articles from cache or regenerate
app.get("/api/weeklyArticles", async (req, res) => {
  try {
    if (!fs.existsSync('./articles.json')) {
      console.warn("⚠️ articles.json not found. Regenerating...");
      await refreshWeeklyArticles();
    }

    const data = fs.readFileSync('./articles.json', 'utf-8');
    const parsed = JSON.parse(data);

    if (!parsed?.articles || typeof parsed.articles !== 'object' || Object.keys(parsed.articles).length === 0) {
      console.warn("⚠️ Invalid or empty articles.json. Regenerating...");
      await refreshWeeklyArticles();
      const refreshed = JSON.parse(fs.readFileSync('./articles.json', 'utf-8'));
      return res.json({ success: true, ...refreshed });
    }

    return res.json({ success: true, ...parsed });

  } catch (err) {
    console.error("❌ Failed to load weekly articles:", err.message);
    res.status(500).json({ success: false, error: "Unable to load weekly articles." });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
