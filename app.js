const express = require("express");
const cors = require("cors");
const path = require("path");
const apiRoutes = require("./routes/apiRoutes");
const publicRoutes = require("./routes/publicRoutes");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(express.json());
app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(authMiddleware);

// Routes
app.use(publicRoutes); // Should be above auth-protected
const emailRoutes = require("./routes/emailRoutes");
app.use("/api/email", emailRoutes);
app.use("/api", apiRoutes);
app.use("/cron", require("./routes/cronRoute"));

module.exports = app;
