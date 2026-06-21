const admin = require("./firebaseAdmin");

const db = admin.firestore();

const saveWeeklyArticles = async (articles) => {
  const docRef = db.collection("weekly_posts").doc("weekly_posts");
  await docRef.set({
    articles,
    updatedAt: new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

const getWeeklyArticles = async () => {
  const docRef = db.collection("weekly_posts").doc("weekly_posts");
  const snapshot = await docRef.get();
  return snapshot.exists ? snapshot.data() : null;
};

module.exports = {
  getWeeklyArticles,
  saveWeeklyArticles,
};
