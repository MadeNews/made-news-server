
const express = require("express");
const router = express.Router();
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();
const transporter = require("../config/email");
const emailVerificationService = require("../services/emailVerificationService");
const { formatResponse } = require("../utils/formatResponse");

router.post("/send-verification", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return res.status(400).json(formatResponse(false, "Valid User ID is required"));
    }

    const result = await emailVerificationService.sendVerificationEmail(userId);
    res.json(formatResponse(true, result.message, result.data));
  } catch (error) {
    console.error("Error in send-verification:", error);
    res.status(500).json(formatResponse(false, error.message || "Failed to send verification email"));
  }
});



router.get("/is-verified/:uid", async (req, res) => {
  const { uid } = req.params;
  if (!uid) {
    return res.status(400).json({ success: false, error: "Missing user ID" });
  }

  try {
    
    const isVerified = await emailVerificationService.isUserVerified(uid)

    res.json(formatResponse(true,"user is verified",isVerified));
  } catch (error) {
    console.error("Error checking verification status:", error);
    res.status(500).json(formatResponse(false,error.message));
  }
});

module.exports = router;
