const admin = require("firebase-admin");
const path = require("path");

// Load service account key from file
const serviceAccount = require("../serviceKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const getCurrentWeekId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil((((now - new Date(year, 0, 1)) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7);
  return `${year}-${String(week).padStart(2, "0")}`;
};

const saveWeeklyArticles = async (articles) => {
  const weekId = getCurrentWeekId();
  const docRef = db.collection("weekly_posts").doc(weekId);
  await docRef.set({
    articles,
    updatedAt: new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

const getWeeklyArticles = async () => {
  const weekId = getCurrentWeekId();
  const docRef = db.collection("weekly_posts").doc(weekId);
  const snapshot = await docRef.get();
  return snapshot.exists ? snapshot.data() : null;
};

module.exports = {
  getWeeklyArticles,
  saveWeeklyArticles,
};
