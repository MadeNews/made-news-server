const serverless = require("serverless-http");
const app = require("../app"); // import your express app

// Wrap the Express app in serverless-http for Vercel
module.exports = serverless(app);

// Vercel background function config
module.exports.config = {
  runtime: "nodejs",  // Node.js runtime
  maxDuration: 600    // Allow up to 10 min for background tasks
};
