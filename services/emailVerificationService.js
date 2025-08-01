const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");


// Create a reusable transporter using environment variables
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE, // e.g., 'gmail'
  auth: {
    user: process.env.EMAIL_USER, // your email address
    pass: process.env.EMAIL_PASSWORD, // your email password or app password
  },
});

// JWT secret for verification tokens
const JWT_SECRET =
  process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this";

class EmailVerificationService {
  constructor() {
    this.db = admin.firestore();
    this.auth = admin.auth();
  }

  /**
   * Generate a secure verification token with 5-minute expiration
   */
  generateVerificationToken(userId, email) {
    const payload = {
      userId: userId,
      email: email,
      type: "email_verification",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes
    };

    return jwt.sign(payload, JWT_SECRET);
  }

  /**
   * Extract email from user ID by querying the users collection
   */
  async extractEmailFromUid(userId) {
    try {
      const userDoc = await this.db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      return userData.email;
    } catch (error) {
      console.error("Error extracting email from UID:", error);
      throw new Error("Failed to extract user email");
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(userId) {
    try {
      const email = await this.extractEmailFromUid(userId);
      const userDoc = await this.db.collection("users").doc(userId).get();
      const userData = userDoc.data();


      if (userData.emailVerified) {
        throw new Error("User is already verified");
      }

      const displayName = userData.username || "User";

      const token = this.generateVerificationToken(userId, email);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Store verification data
      await this.db.collection("email_verifications").doc(userId).set({
        email: email,
        token: token,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: expiresAt,
        verified: false,
        attempts: 0,
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const verificationUrl = `${process.env.SERVER_URL}/verify/${token}`;

      // Send email using Resend
      await transporter.sendMail({
        from: `${process.env.EMAIL_USER}`, // use your email as sender
        to: email,
        subject: "Verify Your Email Address (Expires in 5 minutes)",
        html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Hello ${displayName},</p>
      <p>Please click the button below to verify your email address:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email
        </a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p><strong>⚠️ This link expires in 5 minutes.</strong></p>
      <p>If you didn't request this verification, please ignore this email.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #666; font-size: 12px;">
        This is an automated message from MadeNews. Please do not reply to this email.
      </p>
    </div>
  `,
      });

      return {
        success: true,
        message: "Verification email sent successfully",
        data: email,
      };
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw new Error( error.message || "Failed to send verification email");
    }
  }

  /**
   * Verify email token and mark user as verified
   */
  async verifyEmail(token) {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);

      if (decoded.type !== "email_verification") {
        throw new Error("Invalid token type");
      }

      const { userId, email } = decoded;

      // Check if verification record exists and is not expired
      const verificationDoc = await this.db
        .collection("email_verifications")
        .doc(userId)
        .get();

      if (!verificationDoc.exists) {
        throw new Error("Verification record not found");
      }

      const verificationData = verificationDoc.data();

      if (verificationData.verified) {
        return { success: true, message: "Email already verified" };
      }

      if (new Date() > verificationData.expiresAt.toDate()) {
        throw new Error("Verification token expired");
      }

      if (verificationData.token !== token) {
        throw new Error("Invalid verification token");
      }

      // Update verification record
      await this.db
        .collection("email_verifications")
        .doc(userId)
        .update({
          verified: true,
          verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          attempts: admin.firestore.FieldValue.increment(1),
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Update user document with verification status
      await this.db.collection("users").doc(userId).update({
        emailVerified: true,
        emailVerificationDate: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        message: "Email verified successfully",
        userId: userId,
        email: email,
      };
    } catch (error) {
      console.error("Error verifying email:", error);

      if (error.name === "JsonWebTokenError") {
        throw new Error("Invalid verification token");
      }

      if (error.name === "TokenExpiredError") {
        throw new Error("Verification token expired");
      }

      throw error;
    }
  }

  /**
   * Check if user is verified
   */
async isUserVerified(userId) {
  try {
    const userDoc = await this.db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      throw new Error("User Not Fount with Id: "+userId);
    }

    const userData = userDoc.data();

    // If user is verified, clean up the email_verifications record
    if (userData.emailVerified) {
      const verificationDocRef = this.db.collection("email_verifications").doc(userId);
      const verificationDoc = await verificationDocRef.get();

      if (verificationDoc.exists) {
        await verificationDocRef.delete();
        console.log(`Cleaned up verification record for user: ${userId}`);
      }

      return true
    }

    return false

  } catch (error) {
    console.error("Error checking user verification status:", error);
    throw new Error(error || "Failed to check User Verification Status")
  }
}


  /**
   * Resend verification email
   */
  async resendVerificationEmail(userId) {
    try {
      // Check if user is already verified
      const isVerified = await this.isUserVerified(userId);
      if (isVerified) {
        throw new Error("User is already verified");
      }

      // Check rate limiting
      const verificationDoc = await this.db
        .collection("email_verifications")
        .doc(userId)
        .get();
      if (verificationDoc.exists) {
        const verificationData = verificationDoc.data();
        const lastSent = verificationData.lastAttemptAt?.toDate();
        const now = new Date();

        // Allow resend only after 2 minutes
        if (lastSent && now - lastSent < 2 * 60 * 1000) {
          throw new Error(
            "Please wait 2 minutes before requesting another verification email"
          );
        }
      }

      return await this.sendVerificationEmail(userId);
    } catch (error) {
      console.error("Error resending verification email:", error);
      throw error;
    }
  }

  /**
   * Get verification status with details
   */
  async getVerificationStatus(userId) {
    try {
      const userDoc = await this.db.collection("users").doc(userId).get();
      const verificationDoc = await this.db
        .collection("email_verifications")
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      const verificationData = verificationDoc.exists
        ? verificationDoc.data()
        : null;

      return {
        userId: userId,
        email: userData.email,
        emailVerified: userData.emailVerified || false,
        verificationDate: userData.emailVerificationDate || null,
        lastVerificationAttempt: verificationData?.lastAttemptAt || null,
        verificationExpiresAt: verificationData?.expiresAt || null,
      };
    } catch (error) {
      console.error("Error getting verification status:", error);
      throw error;
    }
  }

  /**
   * Clean up expired verification records
   */
  async cleanupExpiredVerifications() {
    try {
      const now = new Date();
      const expiredVerifications = await this.db
        .collection("email_verifications")
        .where("expiresAt", "<", now)
        .where("verified", "==", false)
        .get();

      const batch = this.db.batch();
      expiredVerifications.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(
        `Cleaned up ${expiredVerifications.docs.length} expired verification records`
      );
    } catch (error) {
      console.error("Error cleaning up expired verifications:", error);
    }
  }
}

module.exports = new EmailVerificationService();
