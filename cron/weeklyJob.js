const cron = require("node-cron");
const refreshWeeklyArticles = require("../refreshWeekly");

module.exports = function () {
  cron.schedule("1 0 * * 1", async () => {
    console.log("⏳ Running weekly article generation...");
    await refreshWeeklyArticles();
    console.log("✅ Weekly articles refreshed.");
  });
};
