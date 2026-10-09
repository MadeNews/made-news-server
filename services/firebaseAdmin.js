const admin = require("firebase-admin");

// Accepts the service account key however it was pasted: raw JSON, JSON wrapped
// in quotes (copied from a .env file into Vercel), or base64-encoded JSON.
const parseServiceKey = (raw) => {
  let value = raw.trim();
  if (/^(['"`]).*\1$/s.test(value)) value = value.slice(1, -1).trim();

  const attempts = [value];
  if (!value.startsWith("{")) {
    try { attempts.push(Buffer.from(value, "base64").toString("utf8")); } catch (_) {}
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && parsed.private_key && parsed.client_email) {
        // keys whose newlines were double-escaped (\\n) still need real newlines
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        return parsed;
      }
    } catch (_) {}
  }

  throw new Error(
    `Invalid GCP_SERVICE_KEY env var (length ${value.length}, starts with ${JSON.stringify(value.slice(0, 2))}). ` +
      "Paste the Firebase service account JSON as-is, without surrounding quotes."
  );
};

const rawServiceKey = process.env.GCP_SERVICE_KEY;

if (!admin.apps.length) {
  if (!rawServiceKey) {
    throw new Error(
      "Missing GCP_SERVICE_KEY env var. Set it to the full Firebase service account JSON."
    );
  }

  const serviceAccount = parseServiceKey(rawServiceKey);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
