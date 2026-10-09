# MadeNews Server

Backend for **MadeNews**, a satire news app in the tradition of The Onion. Every article it produces is fictional, written for laughs, and ends with a satire disclaimer.

The server is an Express app (deployed on Vercel) that:

- writes **one-off satire stories** on any topic, narrated by one of 9 comedy characters;
- builds the **weekly feed**: 2 articles for each of 5 categories, generated in a single request and stored in Firestore;
- handles **email verification** for app users.

Stories are generated with Groq-hosted models (default `openai/gpt-oss-120b`). The prompts follow the **CO-STAR** framework (Context, Objective, Style, Tone, Audience, Response) plus a Boundaries section.

---

## Contents

1. [Quick start](#1-quick-start)
2. [Configuration](#2-configuration)
3. [API reference](#3-api-reference)
4. [How a story is generated](#4-how-a-story-is-generated)
5. [Prompts and personas](#5-prompts-and-personas)
6. [Weekly feed](#6-weekly-feed)
7. [Content moderation](#7-content-moderation)
8. [Email verification](#8-email-verification)
9. [Firestore data model](#9-firestore-data-model)
10. [Project structure](#10-project-structure)
11. [Deployment](#11-deployment)
12. [Troubleshooting](#12-troubleshooting)
13. [Known issues](#13-known-issues)

---

## 1. Quick start

```bash
npm install
cp .env.example .env   # fill in the secrets (section 2); every other value has a working default
node server.js         # http://localhost:3000
# or, to mirror Vercel locally:
vercel dev
```

Every route except `/`, `/story/random` and `/verify/:token` needs the header `x-api-key: <APP_API_KEY>`.

```bash
curl -H "x-api-key: $APP_API_KEY" \
  "http://localhost:3000/api/generate?title=President%20vetoes%20Mondays&satireStyle=gossipAunt"
```

---

## 2. Configuration

All configuration comes from environment variables: `.env` when hosting natively (start from the commented template `.env.example`), or Project Settings → Environment Variables on Vercel. Everything Groq-specific is read in `config/groq.js`, so model or limit changes on Groq's side need a config change, not a code change. Every Groq setting has a default.

### Secrets

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq API key |
| `APP_API_KEY` | Value clients must send in the `x-api-key` header |
| `GCP_SERVICE_KEY` | Firebase service account JSON (see the format note below) |
| `JWT_SECRET` | Signs email verification tokens |
| `EMAIL_USER`, `EMAIL_PASSWORD` | SMTP login for verification emails |

**`GCP_SERVICE_KEY` format:** paste the downloaded service account JSON **on one line**, without quotes. `vercel dev` cannot read multi-line values. To convert the file:

```bash
node -e "console.log(JSON.stringify(require('./service-account.json')))"
```

The key comes from Firebase Console → Project settings → Service accounts → Generate new private key. Never commit it or paste it anywhere public.

### Groq: endpoint, models and limits

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_URL` | Groq chat completions URL | API endpoint |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Model for one-off stories |
| `WEEKLY_GROQ_MODEL` | `GROQ_MODEL` | Model for the weekly batch |
| `GROQ_TPM_LIMIT` | `8000` | Your plan's tokens-per-minute limit; the weekly output budget is derived from it |
| `GROQ_TOKEN_SAFETY_MARGIN` | `350` | Headroom kept below the limit |
| `GROQ_CHARS_PER_TOKEN` | `3.5` | Used to estimate prompt size |
| `GROQ_REQUEST_TIMEOUT_MS` | `120000` | HTTP timeout |
| `GROQ_RETRY_MAX_WAIT_SECONDS` | `65` | Longest wait before retrying a weekly batch after a 429 |

### Groq: reasoning

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_REASONING_EFFORT` | `low` | `low` / `medium` / `high` for reasoning models; `off` for models that reject reasoning params (e.g. Llama) |
| `STORY_REASONING_EFFORT`, `CHARACTER_REASONING_EFFORT`, `WEEKLY_REASONING_EFFORT` | `GROQ_REASONING_EFFORT` | Per-mode override |
| `GROQ_HIDE_REASONING` | `true` | Sends `include_reasoning: false` |

Reasoning tokens count toward the output cap, so a higher effort needs a higher `*_MAX_TOKENS`.

### Generation

| Variable | Default | Purpose |
|---|---|---|
| `STORY_TEMPERATURE`, `STORY_MAX_TOKENS` | `0.85`, `3000` | News-mode stories |
| `CHARACTER_TEMPERATURE`, `CHARACTER_MAX_TOKENS` | `0.95`, `3000` | Character-mode stories |
| `WEEKLY_TEMPERATURE` | `0.85` | Weekly batch |
| `WEEKLY_MAX_TOKENS` | unset | Optional extra cap on the weekly output budget |
| `GROQ_TOP_P` | `0.9` | Nucleus sampling |
| `ARTICLES_PER_CATEGORY` | `2` | Weekly articles per category |

### App and email

| Variable | Purpose |
|---|---|
| `EMAIL_SERVICE` | Nodemailer service name, e.g. `gmail` |
| `SERVER_URL` | Base URL used in verification links, e.g. `https://made-news-server.vercel.app` |

---

## 3. API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/generate?title=<topic>&satireStyle=<personaId>` | key | One story. Without `satireStyle`: news mode with a random narrator. With it: character mode (see [persona IDs](#personas)). |
| GET | `/api/generate/random` | key | One story on a topic the model picks |
| GET | `/api/weeklyArticles` | key | The saved weekly feed |
| GET | `/cron/refreshWeekly` | key | Regenerates the weekly feed (also at `/refreshWeekly`) |
| POST | `/api/email/send-verification` | key | Body `{ "userId": "<firebase uid>" }`; sends a verification email |
| GET | `/api/email/is-verified/:uid` | key | Whether the user's email is verified |
| GET | `/story/random` | public | A random story rendered as an HTML page |
| GET | `/verify/:token` | public | Target of the verification email link |
| GET | `/` | public | Landing page (`public/index.html`) |

**Story response**

```json
{
  "success": true,
  "title": "Parliament Declares Itself Emotionally Unavailable Until Q3",
  "paragraphs": ["…", "…", "…", "MadeNews is a satire service like The Onion. Everything in this article is made up for laughs."],
  "appGenerated": false,
  "createdAt": "2026-10-09T10:58:59.584Z",
  "satireStyle": "gossipAunt"
}
```

`paragraphs` holds the 3 story paragraphs; the last item is always the disclaimer, added by the server.

**Weekly refresh response**

```json
{ "success": true, "newCount": 10, "report": { "Politics": "new (2)", "Aliens": "kept last week" } }
```

**Errors:** `401` wrong or missing API key; `400` missing `title`; `500` with a user-facing message for blocked topics, rate limits ("Rate limit reached.") or unusable model replies.

---

## 4. How a story is generated

`services/SatireService.js → generateSatireStory(topic, exclusions, satireStyle)`

1. **Keyword check:** `utils/promptValidation.js` rejects topics containing banned terms before any model call.
2. **Narrator:** `satireStyle` picks a persona; without it, `promptManager.getRandomPrompt()` picks one, avoiding recently used ones.
3. **Prompt:** `prompts/builder.js` assembles the CO-STAR system message and a user message containing the topic (section 5).
4. **Model call:** one request to Groq through `config/groq.js`, using the mode's temperature, token cap and reasoning effort.
5. **Parsing:** `parseStory` reads the `TITLE:` line and the paragraphs. It also accepts paragraphs separated by single line breaks, drops any disclaimer the model wrote, and treats a first block of more than 25 words as a paragraph, not a title.
6. **Missing title:** if the model skipped the title, one small extra call (about 500 tokens) writes one in the narrator's voice.
7. **Disclaimer:** `prompts/disclaimer.js` is appended as the last paragraph.

Every call logs `📦 story finish_reason=… completion=…`. If a reply is unusable, the server logs the reason and the start of the raw reply.

**Token use:** roughly 2.5–2.8K prompt tokens plus the reply. Story requests stay well under the free tier's 8K tokens per minute.

---

## 5. Prompts and personas

### CO-STAR prompt

`prompts/builder.js` joins one file per section into a single system message, in this order:

| Section | File | What it controls |
|---|---|---|
| Context | `sections/context.js` | MadeNews is a labeled satire app like The Onion |
| Objective | `sections/objective.js` | What to write for the given topic, plus the topic-focus rules: the topic is the subject, the character is the lens |
| Tone | `sections/tone.js` | The persona, its voice samples, banned example lines, Onion-style irony (total conviction, never winking), variety rules |
| Style | `sections/style.js` | Satire craft: absurd premise as fact, escalation, specific but obviously absurd details |
| Audience | `sections/audience.js` | Who the jokes are for |
| Boundaries | `sections/boundaries.js` | What's in scope (including politics), punch-up rule, 8 hard limits |
| Response | `sections/response.js` | Exact output format per mode; the services parse this |

Each rule lives in exactly one file, so one-off and weekly prompts can't contradict each other. The weekly batch uses the compact variants of Style and Boundaries, plus a one-line roster of the characters.

**Modes**

- **News mode** (no `satireStyle`): a news article (headline plus 3 paragraphs of 3–5 sentences, at most 110 words each), narrated by the character.
- **Character mode** (`satireStyle` set): a monologue by the character (title plus 3 paragraphs of 4–6 sentences, at most 120 words each).

### Personas

Personas live in `prompts/SystemPromptsManager.js`. Each has an `id`, `name`, a full `prompt`, a one-line `brief` (used by the weekly roster) and `samples` (example lines that show the voice).

| `satireStyle` id | Name | Voice |
|---|---|---|
| `nostalgicUncle` | Nostalgic Uncle | Compares everything to an invented "good old days", ends with nonsensical old-timey wisdom |
| `techBroVisionary` | Tech Bro Visionary | Pitches everything as a $10B disruption in buzzword soup |
| `trumpStyle` | Trump-Style Ranter | SNL-style rally impression: superlatives, CAPS, nicknames, tangents, chants |
| `genZ` | Gen Z | Terminally online slang, misplaced emojis, 4-second attention span |
| `globalDiplomat` | Global Unity Diplomat | Hollow, soaring platitudes about everything |
| `prManager` | PR Manager | Reframes every disaster as an intentional, visionary triumph |
| `gossipAunt` | Gossip Aunt | "Insider sources", dramatic gasps, teases she never resolves |
| `wallStreetGuru` | Money Mogul | Everything is a trade, with fake tickers, metrics and billionaire worship |
| `hollywoodProducer` | Hollywood Producer | Greenlights every story into a franchise with casting and sequels |

Sample lines, and quoted examples inside a persona's description, are automatically listed in the prompt as **banned lines**, because models tend to copy examples word for word.

**Adding a persona:** add an entry to `systemPrompts` with `id`, `name`, `prompt`, `brief` and 2–3 `samples`. It becomes available as `satireStyle=<id>`, joins the random rotation and the weekly roster automatically. If it should appear on the landing page, add a card to `public/index.html`.

**Tuning tips**

- Voice too tame: raise `CHARACTER_TEMPERATURE`, or set `CHARACTER_REASONING_EFFORT=high`.
- Drifting off topic: lower `CHARACTER_TEMPERATURE` (for example to `0.85`).
- Format problems: check the `📦` log line. `finish_reason=length` means raise `*_MAX_TOKENS`.

---

## 6. Weekly feed

`GET /cron/refreshWeekly` → `refreshWeekly.js` → `services/WeeklyBatchService.js`

- **One request for the whole feed.** `buildWeeklyMessages` asks for every category × `ARTICLES_PER_CATEGORY` articles in a single call and assigns a narrator to each slot up front, so voices are spread evenly. The categories and their briefs come from `categories.json`.
- **Sized to the limit.** Output budget = `GROQ_TPM_LIMIT` − estimated prompt − safety margin, about 6K tokens on the free tier. Paragraph length scales with the batch size. A typical run uses about 4–5K tokens and finishes in about 10 seconds.
- **Parsing.** `services/weeklyBatchParser.js` reads `### Category` blocks and drops any article that is cut off or has no headline. The disclaimer is appended to each article.
- **The feed is never wiped.** A category that comes back short is topped up with last week's articles, an empty category keeps last week's set, and if nothing usable comes back, Firestore isn't touched.
- **Retry.** One automatic retry after a 429, waiting for the time given in `retry-after`.

The refresh is triggered externally (for example by cron-job.org or a GitHub Actions schedule) with the `x-api-key` header. It replaces the live feed.

---

## 7. Content moderation

Two layers:

1. **Before the model call:** `utils/promptValidation.js` matches about 40 banned terms (including spaced or obfuscated spellings) and returns `NO_GO_AREA_DETECTED`.
2. **In the prompt:** the Boundaries section allows political and controversial satire. It tells the model to punch up, to keep real public figures in obviously absurd parody, and to output `NO_GO_AREA_DETECTED: User tried topic "…"` only if no satirical angle avoids one of 8 hard limits. The service turns that into a user-facing error.

---

## 8. Email verification

`services/emailVerificationService.js`, using JWT and Nodemailer:

- **Send:** `POST /api/email/send-verification` reads `users/{uid}` and signs a 5-minute JWT. It stores the token in `email_verifications/{uid}` and emails a link to `${SERVER_URL}/verify/<token>`.
- **Verify:** `GET /verify/:token` checks the JWT signature and type, the stored token, the expiry and whether the user is already verified. It then marks the user as verified.
- **Check:** `GET /api/email/is-verified/:uid` returns the flag and cleans up the verification record once the user is verified.
- **Resend:** limited to once every 2 minutes. A newer token invalidates older ones.

---

## 9. Firestore data model

```
users/{uid}
  email, username, emailVerified, emailVerificationDate

email_verifications/{uid}
  email, token, sentAt, expiresAt, verified, attempts, lastAttemptAt, verifiedAt

weekly_posts/weekly_posts                       (single document, replaced on each refresh)
  articles: { [category]: [{ title, content, createdAt, appGenerated: true, category }] }
  updatedAt: ISO string
  createdAt: server timestamp
```

`content` is the paragraphs joined with blank lines; the last paragraph is the disclaimer.

---

## 10. Project structure

```
├── server.js                 Starts the HTTP listener when run directly (Vercel imports app instead)
├── app.js                    Express app: dotenv, static files, CORS, auth, routes
├── refreshWeekly.js          Weekly refresh entry (reads ARTICLES_PER_CATEGORY)
├── categories.json           Weekly categories and their briefs
├── config/
│   ├── groq.js               All Groq settings from env + request helpers
│   └── email.js              (unused, see Known issues)
├── middleware/
│   └── authMiddleware.js     x-api-key check, public path allowlist
├── routes/
│   ├── newsRoutes.js         /api/generate, /api/generate/random, /api/weeklyArticles
│   ├── cronRoute.js          /cron/refreshWeekly
│   ├── publicRoutes.js       /, /story/random, /refreshWeekly, /verify/:token
│   └── emailRoutes.js        /api/email/*
├── services/
│   ├── SatireService.js      One-off story generation, parsing, title fallback
│   ├── WeeklyBatchService.js Weekly batch generation, merge, save
│   ├── weeklyBatchParser.js  Pure parser for the weekly batch
│   ├── weeklyPostsStorageServices.js  Firestore read/write for the feed
│   ├── emailVerificationService.js    Email verification lifecycle
│   └── firebaseAdmin.js      Firebase Admin init; accepts the key as raw, quoted or base64 JSON
├── prompts/
│   ├── builder.js            Assembles the CO-STAR prompts
│   ├── index.js              Entry point
│   ├── SystemPromptsManager.js  Personas + selection
│   ├── disclaimer.js         Satire disclaimer text
│   └── sections/             context, objective, tone, style, audience, boundaries, response
├── utils/                    promptValidation, escapeHtml, formatResponse, dateHelpers
├── templates/                story.html (for /story/random), verification.html
├── public/                   Landing page (index.html, styles.css, script.js) and assets
└── apidog/                   OpenAPI file for importing the API into Apidog
```

---

## 11. Deployment

- **Vercel:** `vercel.json` sends every route to `server.js` (`@vercel/node`). Set every variable from section 2 in the Vercel project. Env var changes only apply after a new deployment.
- **Timeouts:** the weekly refresh is a single request of about 10–20 seconds, well within Vercel's limits. If your project doesn't use Fluid Compute, the Hobby plan's 10-second limit could still cut it off, so check the project's function settings.
- **Cron:** nothing is scheduled inside the app. Call `/cron/refreshWeekly` weekly from an external scheduler, with the `x-api-key` header.
- **Firebase permissions:** the service account `firebase-adminsdk-fbsvc@<project>.iam.gserviceaccount.com` needs the roles **Firebase Admin SDK Administrator Service Agent** and **Service Account Token Creator** (Google Cloud Console → IAM).

---

## 12. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Invalid GCP_SERVICE_KEY env var (length 1, starts with "{")` | The JSON is spread over several lines and only `{` was read. Put it on one line (section 2), in `.env` and in Vercel's Development variables, then restart `vercel dev`. |
| `Missing GCP_SERVICE_KEY` locally | `.env` isn't being loaded, or the variable is empty. `app.js` loads dotenv on its first line. |
| `7 PERMISSION_DENIED: Missing or insufficient permissions` | The service account is missing its IAM roles (section 11), or `vercel dev` is using a different key from the Vercel dashboard. |
| `429 Rate limit reached` | Over the tokens-per-minute limit. Wait about 60 seconds between Groq calls. Check your actual limits under console.groq.com → Settings → Limits. |
| `Request too large … output tokens per minute (OTPM)` | That model has a low output limit on your plan (e.g. preview models). Use `openai/gpt-oss-120b` or lower `*_MAX_TOKENS`. |
| `getaddrinfo ENOTFOUND api.groq.com` / `fetch failed` | A network or DNS problem on the machine running the server. Check `nslookup api.groq.com`, your VPN or proxy, and your DNS servers. |
| `Incomplete model response` | Check the `📦` and `⚠️ Unusable reply` log lines. `finish_reason=length` means raise `STORY_MAX_TOKENS` / `CHARACTER_MAX_TOKENS` or lower the reasoning effort. |
| Weekly report shows `kept last week` | That category's articles were cut off or malformed. Check `finish_reason` in the log; lower `ARTICLES_PER_CATEGORY` or `WEEKLY_REASONING_EFFORT` if output runs out. |
| Model rejects `reasoning_effort` | It's a non-reasoning model. Set the relevant `*_REASONING_EFFORT=off`. |

---

## 13. Known issues

- `jsonwebtoken` is used by `emailVerificationService.js` but isn't listed in `package.json`. Add it with `npm install jsonwebtoken`.
- `@tensorflow-models/toxicity`, `@tensorflow/tfjs` and `node-cron` are declared but never used.
- `utils/dateHelpers.js` and `config/email.js` aren't used (`emailRoutes.js` imports the transporter but never uses it).
- `routes/emailRoutes.js` writes `dotenv.config` without `()`. This is harmless, because `app.js` loads dotenv first.
- `routes/publicRoutes.js` and `routes/emailRoutes.js` create a Firestore `db` they never use.
- CORS allows only the `Content-Type` and `Authorization` headers, so a browser calling the API with `x-api-key` would be blocked. The mobile app and Apidog aren't affected.
