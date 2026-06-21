const admin = require("firebase-admin");

const rawServiceKey = process.env.GCP_SERVICE_KEY;

if (!admin.apps.length) {
  if (!rawServiceKey) {
    throw new Error(
      "Missing GCP_SERVICE_KEY env var. Set it to the full Firebase service account JSON."
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawServiceKey);
  } catch (error) {
    throw new Error(
      "Invalid GCP_SERVICE_KEY env var. It must be valid JSON from the Firebase service account key."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
