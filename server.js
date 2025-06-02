const { generateSatireStory, generateRandomStory } = require("./llama");
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const refreshWeeklyArticles = require("./refreshWeekly");

require("dotenv").config();

const app = express();
const PORT = 3000;

// ✅ Define PUBLIC paths correctly
const PUBLIC_PATHS = [
  "/story/random",
  "/style.css",
  "/script.js",
  "/app-logo.png",
  "/instagram.png",
  "/favicon.ico",
];

// ✅ Serve static files BEFORE auth middleware
app.use(express.static(path.join(__dirname, "public")));

// ✅ CORS + JSON body parser
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ API key middleware (run AFTER static middleware)
app.use((req, res, next) => {
  const isPublic = PUBLIC_PATHS.some((path) => req.path.startsWith(path));
  if (isPublic) return next();

  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.APP_API_KEY) {
    return res
      .status(401)
      .json({ success: false, error: "Unauthorized access" });
  }
  next();
});

// ✅ Weekly Cron Job
cron.schedule("1 0 * * 1", async () => {
  console.log("⏳ Running weekly article generation...");
  await refreshWeeklyArticles();
  console.log("✅ Weekly articles refreshed.");
});

// ✅ Routes

app.get("/api/generate", async (req, res) => {
  const title = req.query.title;
  if (!title)
    return res.status(400).json({ success: false, error: "Missing 'title'" });

  const result = await generateSatireStory(title);
  if (result.error)
    return res.status(500).json({ success: false, error: result.message });

  res.json({ success: true, ...result });
});


const escapeHtml = (unsafe) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

app.get("/story/random", async (req, res) => {
  try {
    const result = await generateRandomStory();

    // Check for errors from the generator
    if (result.error || !result.title || !result.content || !result.paragraphs?.length) {
      console.warn("⚠️ Incomplete or invalid result from story generator:", result);
      return res.status(503).send("Sorry, we couldn't generate a story right now.");
    }

    const templatePath = path.join(__dirname, "templates", "story.html");
    let html = fs.readFileSync(templatePath, "utf8");

    html = html
      .replace(/{{TITLE}}/g, escapeHtml(result.title))
      .replace(/{{DESCRIPTION}}/g, escapeHtml(result.paragraphs[0]))
      .replace(/{{BODY}}/g, result.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join(""));

    res.send(html);

  } catch (err) {
    console.error("❌ Error generating or rendering story:", err.stack);
    res.status(500).send("Failed to generate story. Please try again later.");
  }
});


app.get("/api/generate/random", async (req, res) => {
  const result = await generateRandomStory();
  if (result.error)
    return res.status(500).json({ success: false, error: result.message });

  res.json({ success: true, ...result });
});

app.get("/api/weeklyArticles", async (req, res) => {
  try {
    if (!fs.existsSync("./articles.json")) {
      console.warn("⚠️ articles.json not found. Regenerating...");
      await refreshWeeklyArticles();
    }

    const data = fs.readFileSync("./articles.json", "utf-8");
    const parsed = JSON.parse(data);

    if (!parsed?.articles || Object.keys(parsed.articles).length === 0) {
      console.warn("⚠️ Empty or invalid articles.json. Regenerating...");
      await refreshWeeklyArticles();
      const refreshed = JSON.parse(fs.readFileSync("./articles.json", "utf-8"));
      return res.json({ success: true, ...refreshed });
    }

    return res.json({ success: true, ...parsed });
  } catch (err) {
    console.error("❌ Error loading weekly articles:", err.message);
    res.status(500).json({ success: false, error: "Unable to load articles." });
  }
});


// ✅ Start server
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
