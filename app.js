const express = require("express");
const cors = require("cors");
const path = require("path");
require("./services/firebaseAdmin");
const apiRoutes = require("./routes/newsRoutes");
const publicRoutes = require("./routes/publicRoutes");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(authMiddleware);

// Routes
app.use(publicRoutes); // Should be above auth-protected
const emailRoutes = require("./routes/emailRoutes");
app.use("/api/email", emailRoutes);
app.use("/api", apiRoutes);
app.use("/cron", require("./routes/cronRoute"));

module.exports = app;
