const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { generateRandomStory } = require("../services/SatireService");
const escapeHtml = require("../utils/escapeHtml");
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();
const emailVerificationService = require("../services/emailVerificationService");
const dotenv = require("dotenv");
const refreshWeekly = require("../refreshWeekly");
dotenv.config()

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

router.get("/refreshWeekly", async (req, res) => {
  await refreshWeekly();
  res.status(200).json({ success: true });
});

router.get("/verify/:token", async (req, res) => {
    const { token } = req.params;
    
    if (!token) {
        return res.status(400).json({ success: false, error: "Missing verification token" });
    }

    try {
        const result = await emailVerificationService.verifyEmail(token);
        res.send(result)
    } catch (error) {
        console.error("Error verifying email:", error);
        res.status(500).json({ success: false, error: "Failed to verify email" });
    }
});

router.get("/",async (req, res) => {

  res.sendFile(path.join(__dirname, "../public/index.html"));

});

module.exports = router;
