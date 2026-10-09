const express = require("express");
const router = express.Router();
const generateAll = require("../refreshWeekly");

router.get("/refreshWeekly", async (_req, res) => {
  try {
    const { newCount, report } = await generateAll();
    res.status(200).json({ success: true, newCount, report });
  } catch (error) {
    console.error("Error during weekly refresh:", error.response?.data ?? error.message);
    res
      .status(500)
      .json({ success: false, error: "Failed to refresh weekly articles" });
  }
});

module.exports = router;
