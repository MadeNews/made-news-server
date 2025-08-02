const serverless = require("serverless-http");
const app = require("../app");

const handler = serverless(app);

module.exports = handler;

module.exports.config = {
  runtime: "nodejs18.x", // Node runtime (specify the exact version)
  maxDuration: 600       // Max duration (10 minutes)
};
