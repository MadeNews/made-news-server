const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { generateRandomStory } = require("../llama");
const escapeHtml = require("../utils/escapeHtml");

router.get("/story/random", async (req, res) => {
  try {
    const result = await generateRandomStory();

    if (result.error || !result.title ||!result.paragraphs?.length) {
      console.warn("⚠️ Invalid story result:", result);
      return res.status(503).send("Sorry, story could not be generated.");
    }

    const templatePath = path.join(__dirname, "../templates/story.html");
    let html = fs.readFileSync(templatePath, "utf8");

    html = html
      .replace(/{{TITLE}}/g, escapeHtml(result.title))
      .replace(/{{DESCRIPTION}}/g, escapeHtml(result.paragraphs[0]))
      .replace(/{{BODY}}/g, result.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join(""));

    res.send(html);
  } catch (err) {
    console.error("❌ Error rendering story:", err);
    res.status(500).send("Error generating story.");
  }
});

module.exports = router;
