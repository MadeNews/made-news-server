const PUBLIC_PATHS = [
  "/story/random",
  "/style.css",
  "/script.js",
  "/app-logo.png",
  "/instagram.png",
  "/favicon.ico",
  "/verify"
];

module.exports = (req, res, next) => {
  const isPublic = PUBLIC_PATHS.some(path => req.path.startsWith(path));
  if (isPublic) return next();

  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.APP_API_KEY) {
    return res.status(401).json({ success: false, error: "Unauthorized access" });
  }

  next();
};
